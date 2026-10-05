import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContribStatus, CycleStatus, GroupStatus, MemberStatus, PaymentSource, PayoutStatus, TxType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PaystackService } from './paystack.service';
import { FeeService } from './fee.service';
import { WalletService } from '../wallet/wallet.service';
import { TrustScoreService } from '../users/trust-score.service';
import {
  NOTIFICATION_EVENTS,
  ContributionReceivedEvent,
  MemberContributedEvent,
  MemberPayoutReceivedEvent,
} from '../notifications/events/notification.events';

const WEBHOOK_TTL = 60 * 60 * 24 * 30; // 30 days

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly paystack: PaystackService,
    private readonly feeService: FeeService,
    private readonly walletService: WalletService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
    private readonly trustScore: TrustScoreService,
  ) {}

  // ── Contribute ──────────────────────────────────────────────────────────────

  async initializeContribution(
    userId: string,
    cycleId: string,
    paymentSource: PaymentSource = PaymentSource.PAYSTACK,
    callbackUrl?: string,
  ) {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: { group: true },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');

    // Find the specific member slot that has (or will have) a contribution for this cycle.
    // With multi-slot, a user may have several GroupMember rows for the same group.
    const existing = await this.prisma.contribution.findFirst({
      where: { cycleId, member: { userId, groupId: cycle.groupId } },
      include: { member: true },
    });

    // If no contribution record yet, fall back to the first active slot for this user/group.
    const member = existing?.member ?? await this.prisma.groupMember.findFirst({
      where: { groupId: cycle.groupId, userId, memberStatus: MemberStatus.ACTIVE },
    });
    if (!member || member.memberStatus !== MemberStatus.ACTIVE) {
      throw new ForbiddenException('Not an active member of this group');
    }

    if (existing?.status === ContribStatus.PAID) {
      throw new BadRequestException('Contribution for this cycle is already paid');
    }

    if (paymentSource === PaymentSource.WALLET) {
      return this.initializeWalletContribution(userId, cycleId, member.id, cycle, existing?.id);
    }

    // ── Paystack path ────────────────────────────────────────────────────────
    // Always generate a fresh reference — if the user abandoned a previous
    // Paystack session, reusing the old reference produces a duplicate-ref error.
    const reference = `contrib_${cycleId.slice(-8)}_${userId.slice(-8)}_${Date.now()}`;

    if (existing) {
      await this.prisma.contribution.update({
        where: { id: existing.id },
        data: { paystackRef: reference },
      });
    } else {
      await this.prisma.contribution.create({
        data: {
          cycleId,
          memberId: member.id,
          amount: cycle.group.contributionAmount,
          dueAt: cycle.dueDate,
          status: ContribStatus.PENDING,
          paystackRef: reference,
        },
      });
    }

    const contributionAmountNgn = Number(cycle.group.contributionAmount);
    const feeAmountNgn = this.feeService.calculateFee(contributionAmountNgn);

    const appliedPenalty = await this.prisma.penalty.findFirst({
      where: { memberId: member.id, contribution: { cycleId }, status: 'APPLIED' },
    });
    const penaltyAmountNgn = appliedPenalty ? Number(appliedPenalty.penaltyAmount) : 0;
    const totalChargedNgn = contributionAmountNgn + feeAmountNgn + penaltyAmountNgn;

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    const resolvedCallbackUrl = callbackUrl ?? `${frontendUrl}/payments/callback`;
    const { authorizationUrl } = await this.paystack.initializeTransaction({
      email: user.email,
      amountNgn: totalChargedNgn,
      reference,
      callbackUrl: resolvedCallbackUrl,
      metadata: { cycleId, memberId: member.id, userId, penaltyId: appliedPenalty?.id },
    });

    return {
      authorizationUrl,
      reference,
      contributionAmountNgn,
      feeAmountNgn,
      totalChargedNgn,
    };
  }

  private async initializeWalletContribution(
    userId: string,
    cycleId: string,
    memberId: string,
    cycle: { groupId: string; dueDate: Date; group: { contributionAmount: unknown; name: string } },
    existingContributionId?: string,
  ) {
    const contributionAmountNgn = Number(cycle.group.contributionAmount);
    const feeAmountNgn = this.feeService.calculateFee(contributionAmountNgn);
    const reference = `contrib_wallet_${cycleId.slice(-8)}_${userId.slice(-8)}_${Date.now()}`;

    const appliedPenalty = await this.prisma.penalty.findFirst({
      where: { memberId, contribution: { cycleId }, status: 'APPLIED' },
    });
    const penaltyAmountNgn = appliedPenalty ? Number(appliedPenalty.penaltyAmount) : 0;
    const totalChargedNgn = contributionAmountNgn + feeAmountNgn + penaltyAmountNgn;

    // Pre-flight balance check against total (contribution + fee + penalty) for a clear 422
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || Number(wallet.balance) < totalChargedNgn) {
      throw new UnprocessableEntityException({
        error: 'INSUFFICIENT_WALLET_BALANCE',
        message: `Wallet balance ₦${Number(wallet?.balance ?? 0).toFixed(2)} is less than the required ₦${totalChargedNgn.toFixed(2)} (contribution ₦${contributionAmountNgn.toFixed(2)} + fee ₦${feeAmountNgn.toFixed(2)}${penaltyAmountNgn > 0 ? ` + penalty ₦${penaltyAmountNgn.toFixed(2)}` : ''})`,
      });
    }

    let contributionId: string;

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      if (existingContributionId) {
        await tx.contribution.update({
          where: { id: existingContributionId },
          data: { status: ContribStatus.PAID, paymentSource: PaymentSource.WALLET, paidAt: new Date() },
        });
        contributionId = existingContributionId;
      } else {
        const created = await tx.contribution.create({
          data: {
            cycleId,
            memberId,
            amount: cycle.group.contributionAmount as number,
            dueAt: cycle.dueDate,
            status: ContribStatus.PAID,
            paymentSource: PaymentSource.WALLET,
            paystackRef: reference,
            paidAt: new Date(),
          },
        });
        contributionId = created.id;
      }

      await this.feeService.collectFee(contributionId, userId, contributionAmountNgn, tx);

      if (appliedPenalty) {
        await tx.penalty.update({
          where: { id: appliedPenalty.id },
          data: { status: 'WAIVED' },
        });
      }

      // Debit full amount (contribution + fee + penalty) in one atomic wallet operation
      await this.walletService.debit(userId, totalChargedNgn, reference, TxType.CONTRIBUTION, tx);
    });

    this.eventEmitter.emit(NOTIFICATION_EVENTS.CONTRIBUTION_RECEIVED, {
      userId,
      amountNgn: contributionAmountNgn,
      groupName: cycle.group.name,
    } satisfies ContributionReceivedEvent);
    this.emitMemberContributed(userId, cycle.groupId, cycle.group.name, contributionAmountNgn).catch(() => null);

    // Trust score: on-time vs late
    const paidAt = new Date();
    const isOnTime = paidAt <= cycle.dueDate;
    const scoreEventType = isOnTime ? 'ON_TIME_CONTRIBUTION' as const : 'LATE_CONTRIBUTION' as const;
    const scoreDelta = isOnTime ? 5 : -5;
    this.trustScore.applyScoreEvent(
      userId, scoreEventType, scoreDelta,
      `${isOnTime ? 'On-time' : 'Late'} contribution — ${cycle.group.name}`,
      { groupId: cycle.groupId, contributionId: contributionId! },
    ).catch(() => null);

    const unpaid = await this.prisma.contribution.count({
      where: { cycleId, status: { not: ContribStatus.PAID } },
    });
    if (unpaid === 0) {
      await this.triggerPayout(cycleId).catch((err: Error) =>
        this.logger.error(`Payout trigger failed for cycle ${cycleId}: ${err.message}`),
      );
    }

    return {
      paid: true,
      paymentSource: PaymentSource.WALLET,
      reference,
      contributionAmountNgn,
      feeAmountNgn,
      totalChargedNgn,
    };
  }

  // ── Verify ──────────────────────────────────────────────────────────────────

  async verifyPayment(userId: string, reference: string) {
    const result = await this.paystack.verifyTransaction(reference);

    const contribution = await this.prisma.contribution.findFirst({
      where: { paystackRef: reference },
      include: {
        member: true,
        cycle: { include: { group: { select: { id: true, name: true } } } },
      },
    });

    if (result.status === 'success' && contribution && contribution.member.userId === userId && contribution.status !== ContribStatus.PAID) {
      await this.handleChargeSuccess({ reference, amount: result.amountKobo });
    }

    return {
      status: result.status,
      amount: result.amountKobo ? result.amountKobo / 100 : contribution ? Number(contribution.amount) : undefined,
      groupId: contribution?.cycle.group.id,
      groupName: contribution?.cycle.group.name,
      cycleNumber: contribution?.cycle.cycleNumber,
    };
  }

  // ── Webhook handlers ────────────────────────────────────────────────────────

  async handleWebhook(event: string, data: Record<string, unknown>): Promise<void> {
    this.logger.log(`Paystack event: ${event}`);
    switch (event) {
      case 'charge.success':
        if ((data['channel'] as string) === 'dedicated_nuban') {
          await this.handleDvaCharge(data);
        } else {
          await this.handleChargeSuccess(data);
        }
        break;
      case 'transfer.success':
        await this.handleTransferSuccess(data);
        break;
      case 'transfer.failed':
      case 'transfer.reversed':
        await this.handleTransferFailed(data);
        break;
      case 'dedicated_account.assign.success':
        this.logger.log(`DVA assigned: ${JSON.stringify(data['dedicated_account'])}`);
        break;
      default:
        this.logger.debug(`Unhandled Paystack event: ${event}`);
    }
  }

  async handleChargeSuccess(data: Record<string, unknown>): Promise<void> {
    const reference = data['reference'] as string;
    const idempotencyKey = `webhook:charge:${reference}`;

    if (await this.redis.get(idempotencyKey)) return;

    // Debt repayment — route to protection module via event
    if (reference.startsWith('debt_')) {
      this.eventEmitter.emit('debt.payment.success', { reference });
      await this.redis.set(idempotencyKey, '1', WEBHOOK_TTL);
      return;
    }

    const contribution = await this.prisma.contribution.findFirst({
      where: { paystackRef: reference },
      include: { member: true, cycle: true },
    });

    if (!contribution || contribution.status === ContribStatus.PAID) {
      await this.redis.set(idempotencyKey, '1', WEBHOOK_TTL);
      return;
    }

    const rawKobo = (data['amount'] as number | undefined) ?? 0;
    const amountNgn = rawKobo > 0 ? rawKobo / 100 : await this.getContributionAmount(contribution.cycleId);
    const contributionAmountNgn = Number(contribution.amount);

    const appliedPenalty = await this.prisma.penalty.findFirst({
      where: { memberId: contribution.memberId, contribution: { cycleId: contribution.cycleId }, status: 'APPLIED' },
    });

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.contribution.update({
        where: { id: contribution.id },
        data: { status: ContribStatus.PAID, paidAt: new Date() },
      });
      await this.feeService.collectFee(contribution.id, contribution.member.userId, contributionAmountNgn, tx);
      if (appliedPenalty) {
        await tx.penalty.update({ where: { id: appliedPenalty.id }, data: { status: 'WAIVED' } });
      }
    });

    await this.redis.set(idempotencyKey, '1', WEBHOOK_TTL);

    // Notify contributor of successful payment
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: contribution.cycleId },
      include: { group: { select: { name: true } } },
    });
    if (cycle) {
      const evt: ContributionReceivedEvent = {
        userId: contribution.member.userId,
        amountNgn,
        groupName: cycle.group.name,
      };
      this.eventEmitter.emit(NOTIFICATION_EVENTS.CONTRIBUTION_RECEIVED, evt);
      this.emitMemberContributed(contribution.member.userId, cycle.groupId, cycle.group.name, amountNgn).catch(() => null);

      // Trust score: on-time vs late
      const paidAt = new Date();
      const isOnTime = paidAt <= cycle.dueDate;
      this.trustScore.applyScoreEvent(
        contribution.member.userId,
        isOnTime ? 'ON_TIME_CONTRIBUTION' : 'LATE_CONTRIBUTION',
        isOnTime ? 5 : -5,
        `${isOnTime ? 'On-time' : 'Late'} contribution — ${cycle.group.name}`,
        { groupId: cycle.groupId, contributionId: contribution.id },
      ).catch(() => null);
    }

    const unpaid = await this.prisma.contribution.count({
      where: { cycleId: contribution.cycleId, status: { not: ContribStatus.PAID } },
    });

    if (unpaid === 0) {
      await this.triggerPayout(contribution.cycleId).catch((err: Error) =>
        this.logger.error(`Payout trigger failed for cycle ${contribution.cycleId}: ${err.message}`),
      );
    }
  }

  async handleDvaCharge(data: Record<string, unknown>): Promise<void> {
    const reference = data['reference'] as string;
    const idempotencyKey = `webhook:dva:${reference}`;

    if (await this.redis.get(idempotencyKey)) return;

    const amountNgn = ((data['amount'] as number) ?? 0) / 100;

    // Identify the group from the Paystack customer code
    const customer = (data['customer'] as Record<string, unknown>) ?? {};
    const customerCode = customer['customer_code'] as string | undefined;

    if (!customerCode) {
      this.logger.warn(`DVA ${reference}: no customer_code in payload`);
      await this.redis.set(idempotencyKey, '1', WEBHOOK_TTL);
      return;
    }

    const groupAccount = await this.prisma.groupAccount.findFirst({
      where: { paystackCustomerCode: customerCode },
      select: { groupId: true },
    });

    if (!groupAccount) {
      this.logger.warn(`DVA ${reference}: no group for customer ${customerCode}`);
      await this.redis.set(idempotencyKey, '1', WEBHOOK_TTL);
      return;
    }

    const { groupId } = groupAccount;

    // ── Match the contribution ──────────────────────────────────────────────────

    let contributionId: string | null = null;

    // Primary: our reference embedded in the transfer narration
    const authorization = (data['authorization'] as Record<string, unknown>) ?? {};
    const narration = (authorization['narration'] as string | undefined) ?? '';
    const refMatch = narration.match(/contrib_[a-z0-9_]+/i);

    if (refMatch?.[0]) {
      const found = await this.prisma.contribution.findFirst({
        where: { paystackRef: refMatch[0], status: { not: ContribStatus.PAID } },
        select: { id: true },
      });
      contributionId = found?.id ?? null;
    }

    // Secondary: single pending contribution in the current active/pending cycle
    if (!contributionId) {
      const activeCycle = await this.prisma.cycle.findFirst({
        where: { groupId, status: { in: [CycleStatus.ACTIVE, CycleStatus.PENDING] } },
        orderBy: { cycleNumber: 'asc' },
        select: { id: true },
      });

      if (activeCycle) {
        const pending = await this.prisma.contribution.findMany({
          where: { cycleId: activeCycle.id, status: ContribStatus.PENDING },
          select: { id: true, amount: true },
        });

        const matching = pending.filter((c) => Number(c.amount) === amountNgn);

        if (matching.length === 1) {
          contributionId = matching[0].id;
        } else {
          this.logger.warn(
            `DVA ${reference}: ${matching.length} matching pending contributions ` +
              `for group ${groupId} (₦${amountNgn}) — needs manual reconciliation`,
          );
          await this.redis.set(idempotencyKey, '1', WEBHOOK_TTL);
          return;
        }
      }
    }

    if (!contributionId) {
      this.logger.warn(
        `DVA ${reference}: no matching contribution for group ${groupId} (₦${amountNgn})`,
      );
      await this.redis.set(idempotencyKey, '1', WEBHOOK_TTL);
      return;
    }

    // ── Apply payment ───────────────────────────────────────────────────────────

    const contribution = await this.prisma.contribution.findUniqueOrThrow({
      where: { id: contributionId },
      include: { member: true, cycle: { include: { group: { select: { name: true } } } } },
    });

    if (contribution.status === ContribStatus.PAID) {
      await this.redis.set(idempotencyKey, '1', WEBHOOK_TTL);
      return;
    }

    const contributionAmountNgn = Number(contribution.amount);

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.contribution.update({
        where: { id: contribution.id },
        data: { status: ContribStatus.PAID, paidAt: new Date(), paystackRef: reference },
      });
      await this.feeService.collectFee(contribution.id, contribution.member.userId, contributionAmountNgn, tx);
    });

    await this.redis.set(idempotencyKey, '1', WEBHOOK_TTL);

    const evt: ContributionReceivedEvent = {
      userId: contribution.member.userId,
      amountNgn,
      groupName: contribution.cycle.group.name,
    };
    this.eventEmitter.emit(NOTIFICATION_EVENTS.CONTRIBUTION_RECEIVED, evt);
    this.emitMemberContributed(contribution.member.userId, groupId, contribution.cycle.group.name, amountNgn).catch(() => null);

    const unpaid = await this.prisma.contribution.count({
      where: { cycleId: contribution.cycleId, status: { not: ContribStatus.PAID } },
    });

    if (unpaid === 0) {
      await this.triggerPayout(contribution.cycleId).catch((err: Error) =>
        this.logger.error(`Payout trigger failed for cycle ${contribution.cycleId}: ${err.message}`),
      );
    }
  }

  async handleTransferSuccess(data: Record<string, unknown>): Promise<void> {
    const transferCode = data['transfer_code'] as string;
    const idempotencyKey = `webhook:transfer:${transferCode}`;

    if (await this.redis.get(idempotencyKey)) return;

    const payout = await this.prisma.payout.findFirst({
      where: { paystackTransferCode: transferCode },
    });

    if (!payout || payout.status === PayoutStatus.COMPLETED) {
      await this.redis.set(idempotencyKey, '1', WEBHOOK_TTL);
      return;
    }

    const amountNgn = ((data['amount'] as number) ?? 0) / 100;

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.payout.update({
        where: { id: payout.id },
        data: { status: PayoutStatus.COMPLETED, completedAt: new Date() },
      });

      await this.walletService.credit(
        payout.recipientId,
        amountNgn,
        `wt_payout_${transferCode}`,
        TxType.PAYOUT,
        tx,
      );
    });

    await this.redis.set(idempotencyKey, '1', WEBHOOK_TTL);
  }

  async handleTransferFailed(data: Record<string, unknown>): Promise<void> {
    const transferCode = data['transfer_code'] as string;
    const idempotencyKey = `webhook:transfer:failed:${transferCode}`;

    if (await this.redis.get(idempotencyKey)) return;

    // Check if this is a group payout transfer
    const payout = await this.prisma.payout.findFirst({
      where: { paystackTransferCode: transferCode },
    });

    if (payout && payout.status !== PayoutStatus.FAILED) {
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: { status: PayoutStatus.FAILED },
      });
      this.logger.warn(`Transfer failed: payout ${payout.id} (${transferCode}) — manual review needed`);
    }

    // Check if this is a wallet withdrawal transfer — if so, reverse the debit
    if (!payout) {
      const withdrawalRaw = await this.redis.get(`wallet:withdraw:transfer:${transferCode}`);
      if (withdrawalRaw) {
        const { userId, amount, reference } = JSON.parse(withdrawalRaw) as { userId: string; amount: number; reference: string };
        await this.walletService
          .credit(userId, amount, `reversal_${reference}`, TxType.WITHDRAWAL)
          .catch((err: Error) => this.logger.error(`Withdrawal reversal failed for ${userId}: ${err.message}`));
        this.logger.warn(`Withdrawal transfer failed — reversed ₦${amount} to wallet for user ${userId}`);
      }
    }

    await this.redis.set(idempotencyKey, '1', WEBHOOK_TTL);
  }

  // ── Lists ───────────────────────────────────────────────────────────────────

  async listContributions(userId: string) {
    const members = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { id: true },
    });
    const memberIds = members.map((m) => m.id);

    return this.prisma.contribution.findMany({
      where: { memberId: { in: memberIds } },
      include: { cycle: { include: { group: { select: { id: true, name: true } } } } },
      orderBy: { dueAt: 'desc' },
    });
  }

  async listPayouts(userId: string) {
    return this.prisma.payout.findMany({
      where: { recipientId: userId },
      include: { cycle: { include: { group: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNextPayout(userId: string) {
    const groupSelect = {
      select: {
        id: true,
        name: true,
        contributionAmount: true,
        members: { where: { memberStatus: MemberStatus.ACTIVE }, select: { id: true } },
      },
    } as const;

    // Active cycle takes precedence — collection is happening right now
    const active = await this.prisma.cycle.findFirst({
      where: { recipientId: userId, status: CycleStatus.ACTIVE },
      include: { group: groupSelect },
    });

    const cycle =
      active ??
      (await this.prisma.cycle.findFirst({
        where: { recipientId: userId, status: CycleStatus.PENDING },
        orderBy: { cycleNumber: 'asc' },
        include: { group: groupSelect },
      }));

    if (!cycle) return null;

    const memberCount = cycle.group.members.length;
    const amountNgn = Number(cycle.group.contributionAmount) * memberCount;

    return {
      groupId: cycle.groupId,
      groupName: cycle.group.name,
      cycleNumber: cycle.cycleNumber,
      amountNgn,
      dueDate: cycle.dueDate.toISOString(),
      isActive: cycle.status === CycleStatus.ACTIVE,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async triggerPayout(cycleId: string): Promise<void> {
    const cycle = await this.prisma.cycle.findUniqueOrThrow({
      where: { id: cycleId },
      include: { group: true },
    });

    const agg = await this.prisma.contribution.aggregate({
      where: { cycleId, status: ContribStatus.PAID },
      _sum: { amount: true },
    });
    // Fees are collected at contribution time (see FeeService.collectFee / ticket #55).
    // The payout amount is the full pooled contribution total with ZERO fee deduction —
    // the recipient receives every kobo contributed by all members.
    const payoutAmount = Number(agg._sum.amount ?? 0);
    const payoutRef = `payout_${cycleId.slice(-8)}_${Date.now()}`;

    // ── 1. Create payout record + credit recipient's wallet atomically ─────────
    const now = new Date();
    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.payout.create({
        data: {
          cycleId,
          recipientId: cycle.recipientId,
          amount: payoutAmount,
          status: PayoutStatus.COMPLETED,
          initiatedAt: now,
          completedAt: now,
        },
      });

      await this.walletService.credit(
        cycle.recipientId,
        payoutAmount,
        payoutRef,
        TxType.PAYOUT,
        tx,
      );
    });

    // ── 2. Mark current cycle COMPLETED ──────────────────────────────────────
    await this.prisma.cycle.update({
      where: { id: cycleId },
      data: { status: CycleStatus.COMPLETED, payoutDate: new Date() },
    });

    // ── 3. Activate next cycle (or complete the group) ────────────────────────
    const nextCycle = await this.prisma.cycle.findFirst({
      where: { groupId: cycle.groupId, status: CycleStatus.PENDING },
      orderBy: { cycleNumber: 'asc' },
    });

    if (nextCycle) {
      // Activate next cycle and pre-create contributions for all active members
      const activeMembers = await this.prisma.groupMember.findMany({
        where: { groupId: cycle.groupId, memberStatus: MemberStatus.ACTIVE },
        select: { id: true },
      });

      await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.cycle.update({
          where: { id: nextCycle.id },
          data: { status: CycleStatus.ACTIVE },
        });
        for (const member of activeMembers) {
          await tx.contribution.upsert({
            where: { cycleId_memberId: { cycleId: nextCycle.id, memberId: member.id } },
            create: {
              cycleId: nextCycle.id,
              memberId: member.id,
              amount: cycle.group.contributionAmount,
              dueAt: nextCycle.dueDate,
              status: ContribStatus.PENDING,
            },
            update: {},
          });
        }
      });

      this.logger.log(`Cycle ${cycle.cycleNumber} completed → cycle ${nextCycle.cycleNumber} now ACTIVE`);
    } else {
      // All cycles done — close the group
      await this.prisma.group.update({
        where: { id: cycle.groupId },
        data: { status: GroupStatus.COMPLETED },
      });
      this.logger.log(`All cycles completed for group ${cycle.groupId} — group marked COMPLETED`);
    }

    this.emitMemberPayoutReceived(cycle.recipientId, cycle.groupId, cycle.group.name, payoutAmount).catch(() => null);
  }

  private async emitMemberContributed(
    payerUserId: string,
    groupId: string,
    groupName: string,
    amountNgn: number,
  ): Promise<void> {
    const [payer, others] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: payerUserId }, select: { fullName: true } }),
      this.prisma.groupMember.findMany({
        where: { groupId, memberStatus: MemberStatus.ACTIVE, userId: { not: payerUserId } },
        select: { userId: true },
      }),
    ]);
    const evt: MemberContributedEvent = {
      payerName: payer.fullName,
      groupName,
      amountNgn,
      otherMemberUserIds: others.map((m) => m.userId),
    };
    this.eventEmitter.emit(NOTIFICATION_EVENTS.MEMBER_CONTRIBUTED, evt);
  }

  private async emitMemberPayoutReceived(
    recipientUserId: string,
    groupId: string,
    groupName: string,
    amountNgn: number,
  ): Promise<void> {
    const [recipient, others] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: recipientUserId }, select: { fullName: true } }),
      this.prisma.groupMember.findMany({
        where: { groupId, memberStatus: MemberStatus.ACTIVE, userId: { not: recipientUserId } },
        select: { userId: true },
      }),
    ]);
    const evt: MemberPayoutReceivedEvent = {
      recipientName: recipient.fullName,
      groupName,
      amountNgn,
      otherMemberUserIds: others.map((m) => m.userId),
    };
    this.eventEmitter.emit(NOTIFICATION_EVENTS.MEMBER_PAYOUT_RECEIVED, evt);
  }

  private async getContributionAmount(cycleId: string): Promise<number> {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: { group: true },
    });
    return Number(cycle?.group.contributionAmount ?? 0);
  }
}
