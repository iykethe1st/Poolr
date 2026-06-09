import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContribStatus, MemberStatus, PayoutStatus, TxDirection, TxType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PaystackService } from './paystack.service';
import {
  NOTIFICATION_EVENTS,
  ContributionReceivedEvent,
} from '../notifications/events/notification.events';

const WEBHOOK_TTL = 60 * 60 * 24 * 30; // 30 days

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly paystack: PaystackService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Contribute ──────────────────────────────────────────────────────────────

  async initializeContribution(userId: string, cycleId: string) {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: { group: true },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');

    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: cycle.groupId, userId } },
    });
    if (!member || member.memberStatus !== MemberStatus.ACTIVE) {
      throw new ForbiddenException('Not an active member of this group');
    }

    const existing = await this.prisma.contribution.findUnique({
      where: { cycleId_memberId: { cycleId, memberId: member.id } },
    });

    if (existing?.status === ContribStatus.PAID) {
      throw new BadRequestException('Contribution for this cycle is already paid');
    }

    let reference: string;

    if (existing?.paystackRef) {
      reference = existing.paystackRef;
    } else {
      reference = `contrib_${cycleId.slice(-8)}_${userId.slice(-8)}_${Date.now()}`;

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
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const { authorizationUrl } = await this.paystack.initializeTransaction({
      email: user.email,
      amountNgn: Number(cycle.group.contributionAmount),
      reference,
      metadata: { cycleId, memberId: member.id, userId },
    });

    return { authorizationUrl, reference };
  }

  // ── Verify ──────────────────────────────────────────────────────────────────

  async verifyPayment(userId: string, reference: string) {
    const result = await this.paystack.verifyTransaction(reference);

    if (result.status === 'success') {
      const contribution = await this.prisma.contribution.findFirst({
        where: { paystackRef: reference },
        include: { member: true },
      });

      if (contribution && contribution.member.userId === userId && contribution.status !== ContribStatus.PAID) {
        await this.handleChargeSuccess({ reference, amount: result.amountKobo });
      }
    }

    return { status: result.status };
  }

  // ── Webhook handlers ────────────────────────────────────────────────────────

  async handleWebhook(event: string, data: Record<string, unknown>): Promise<void> {
    this.logger.log(`Paystack event: ${event}`);
    switch (event) {
      case 'charge.success':
        await this.handleChargeSuccess(data);
        break;
      case 'transfer.success':
        await this.handleTransferSuccess(data);
        break;
      case 'transfer.failed':
      case 'transfer.reversed':
        await this.handleTransferFailed(data);
        break;
      default:
        this.logger.debug(`Unhandled Paystack event: ${event}`);
    }
  }

  async handleChargeSuccess(data: Record<string, unknown>): Promise<void> {
    const reference = data['reference'] as string;
    const idempotencyKey = `webhook:charge:${reference}`;

    if (await this.redis.get(idempotencyKey)) return;

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

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.contribution.update({
        where: { id: contribution.id },
        data: { status: ContribStatus.PAID, paidAt: new Date() },
      });

      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: contribution.member.userId } });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: amountNgn,
          type: TxType.CONTRIBUTION,
          direction: TxDirection.CREDIT,
          reference: `wt_contrib_${reference}`,
        },
      });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amountNgn } },
      });
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

      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: payout.recipientId } });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: amountNgn,
          type: TxType.PAYOUT,
          direction: TxDirection.CREDIT,
          reference: `wt_payout_${transferCode}`,
        },
      });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amountNgn } },
      });
    });

    await this.redis.set(idempotencyKey, '1', WEBHOOK_TTL);
  }

  async handleTransferFailed(data: Record<string, unknown>): Promise<void> {
    const transferCode = data['transfer_code'] as string;
    const idempotencyKey = `webhook:transfer:failed:${transferCode}`;

    if (await this.redis.get(idempotencyKey)) return;

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
    const payoutAmount = Number(agg._sum.amount ?? 0);

    const payoutRef = `payout_${cycleId.slice(-8)}_${Date.now()}`;

    const payout = await this.prisma.payout.create({
      data: {
        cycleId,
        recipientId: cycle.recipientId,
        amount: payoutAmount,
        status: PayoutStatus.INITIATED,
        initiatedAt: new Date(),
      },
    });

    const { transferCode } = await this.paystack.initiateTransfer({
      amountNgn: payoutAmount,
      recipientCode: `rcpt_${cycle.recipientId}`,
      reference: payoutRef,
      reason: `Poolr payout — cycle ${cycle.cycleNumber}`,
    });

    await this.prisma.payout.update({
      where: { id: payout.id },
      data: { paystackTransferCode: transferCode },
    });
  }

  private async getContributionAmount(cycleId: string): Promise<number> {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: { group: true },
    });
    return Number(cycle?.group.contributionAmount ?? 0);
  }
}
