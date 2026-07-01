import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { BanReason, NotifChannel, PayoutStatus, UserStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TrustScoreService } from '../users/trust-score.service';

@Injectable()
export class DefaultProtectionService {
  private readonly logger = new Logger(DefaultProtectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trustScore: TrustScoreService,
  ) {}

  /**
   * Scenario A — recipient already received payout and then defaulted.
   * Ban the user, flag their identity, record the debt.
   */
  async handlePostPayoutDefault(
    userId: string,
    cycleId: string,
    missedAmountNgn: number,
    kycBvn?: string | null,
    kycNin?: string | null,
  ): Promise<void> {
    this.logger.warn(`Post-payout default detected for user ${userId} on cycle ${cycleId}`);

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.BANNED },
      });

      await tx.banRecord.create({
        data: {
          userId,
          reason: BanReason.RECEIVED_PAYOUT_THEN_DEFAULTED,
          notes: `Auto-banned: defaulted on cycle ${cycleId} after receiving payout`,
        },
      });

      // Flag identity — store only hashes, never plaintext
      const bvnHash = kycBvn ? this.sha256(kycBvn) : null;
      const ninHash = kycNin ? this.sha256(kycNin) : null;

      if (bvnHash || ninHash) {
        await tx.flaggedIdentity.upsert({
          where: { userId },
          create: {
            userId,
            bvnHash,
            ninHash,
            flaggedReason: `Post-payout default on cycle ${cycleId}`,
          },
          update: {
            bvnHash: bvnHash ?? undefined,
            ninHash: ninHash ?? undefined,
            flaggedAt: new Date(),
            flaggedReason: `Post-payout default on cycle ${cycleId}`,
          },
        });
      }

      await tx.debt.create({
        data: {
          userId,
          cycleId,
          amountNgn: missedAmountNgn,
        },
      });
    });

    await this.prisma.notification.create({
      data: {
        userId,
        title: 'Account Banned',
        body: 'Your account has been banned due to non-payment after receiving a payout. Contact support to resolve your outstanding debt.',
        channel: NotifChannel.IN_APP,
      },
    });

    this.trustScore.applyScoreEvent(
      userId, 'ACCOUNT_BANNED', -30,
      `Banned: received payout then defaulted on cycle ${cycleId}`,
      { groupId: (await this.prisma.cycle.findUnique({ where: { id: cycleId }, select: { groupId: true } }))?.groupId },
    ).catch(() => null);

    this.logger.log(`User ${userId} banned and debt of ₦${missedAmountNgn} recorded for cycle ${cycleId}`);
  }

  /**
   * Scenario B — recipient has NOT yet received payout; freeze account and hold payout.
   */
  async handlePrePayoutDefault(
    userId: string,
    cycleId: string,
    missedAmountNgn: number,
  ): Promise<void> {
    this.logger.warn(`Pre-payout default detected for user ${userId} on cycle ${cycleId}`);

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.FROZEN },
      });

      await tx.cycle.update({
        where: { id: cycleId },
        data: {
          payoutHeld: true,
          payoutHeldReason: `Recipient ${userId} has outstanding default`,
        },
      });

      await tx.debt.create({
        data: {
          userId,
          cycleId,
          amountNgn: missedAmountNgn,
        },
      });
    });

    await this.prisma.notification.create({
      data: {
        userId,
        title: 'Account Frozen',
        body: 'Your account has been temporarily frozen due to a missed contribution. Pay your outstanding debt to restore access and receive your payout.',
        channel: NotifChannel.IN_APP,
      },
    });

    this.trustScore.applyScoreEvent(
      userId, 'ACCOUNT_FROZEN', -15,
      `Account frozen: missed contribution on cycle ${cycleId}`,
      { groupId: (await this.prisma.cycle.findUnique({ where: { id: cycleId }, select: { groupId: true } }))?.groupId },
    ).catch(() => null);

    this.logger.log(`User ${userId} frozen and payout held for cycle ${cycleId}`);
  }

  /**
   * After a frozen user clears their debt, unfreeze them and release the held payout.
   * Returns true if the payout should now be released (processed by caller).
   */
  async liftFreeze(userId: string, cycleId: string): Promise<boolean> {
    const cycle = await this.prisma.cycle.findUnique({ where: { id: cycleId } });
    if (!cycle?.payoutHeld) return false;

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.ACTIVE },
      });
      await tx.cycle.update({
        where: { id: cycleId },
        data: { payoutHeld: false, payoutHeldReason: null },
      });
    });

    this.logger.log(`Freeze lifted for user ${userId}, payout released for cycle ${cycleId}`);
    return true;
  }

  /**
   * Multi-slot check: has this user received a payout on ANY slot in this group?
   * Used to determine Scenario A (ban) vs Scenario B (freeze) when a user defaults.
   */
  async hasReceivedPayoutInGroup(userId: string, groupId: string): Promise<boolean> {
    const payout = await this.prisma.payout.findFirst({
      where: {
        recipientId: userId,
        cycle: { groupId },
        status: { in: [PayoutStatus.INITIATED, PayoutStatus.COMPLETED] },
      },
    });
    return payout !== null;
  }

  /** Check whether a new KYC submission matches a flagged identity hash. */
  async isFlaggedIdentity(bvn?: string | null, nin?: string | null): Promise<boolean> {
    if (!bvn && !nin) return false;

    const bvnHash = bvn ? this.sha256(bvn) : null;
    const ninHash = nin ? this.sha256(nin) : null;

    const match = await this.prisma.flaggedIdentity.findFirst({
      where: {
        OR: [
          ...(bvnHash ? [{ bvnHash }] : []),
          ...(ninHash ? [{ ninHash }] : []),
        ],
      },
    });

    return match !== null;
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
