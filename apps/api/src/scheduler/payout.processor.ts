import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import {
  ContribStatus,
  CycleStatus,
  NotifChannel,
  PayoutStatus,
  PenaltyReason,
  PenaltyStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PaystackService } from '../payments/paystack.service';
import {
  PAYOUT_EVENTS,
  PayoutDeadLetteredEvent,
  PayoutInitiatedEvent,
  PayoutJobData,
} from './events/payout.events';

@Processor('payout')
export class PayoutProcessor extends WorkerHost {
  private readonly logger = new Logger(PayoutProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<PayoutJobData>): Promise<{ transferCode?: string; amountNgn?: number; skipped?: boolean; reason?: string }> {
    const { cycleId } = job.data;
    this.logger.log(`Processing payout job for cycle ${cycleId} (attempt ${job.attemptsMade + 1})`);

    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        group: true,
        contributions: { include: { member: true } },
      },
    });

    if (!cycle) throw new Error(`Cycle ${cycleId} not found`);

    // Idempotency — skip if payout already initiated or completed
    const existingPayout = await this.prisma.payout.findFirst({
      where: {
        cycleId,
        status: { in: [PayoutStatus.INITIATED, PayoutStatus.COMPLETED] },
      },
    });
    if (existingPayout) {
      this.logger.log(`Cycle ${cycleId}: payout already ${existingPayout.status}, skipping`);
      return { skipped: true, reason: `payout already ${existingPayout.status}` };
    }

    // Apply penalties to unpaid contributions
    const unpaid = cycle.contributions.filter((c) => c.status !== ContribStatus.PAID);
    if (unpaid.length > 0) {
      this.logger.warn(`Cycle ${cycleId}: ${unpaid.length} unpaid contribution(s), applying penalties`);
      await this.applyPenalties(cycleId, unpaid);
    }

    // Compute disbursement amount
    const paid = cycle.contributions.filter((c) => c.status === ContribStatus.PAID);
    const payoutAmountNgn = paid.reduce((sum, c) => sum + Number(c.amount), 0);

    if (payoutAmountNgn === 0) {
      this.logger.warn(`Cycle ${cycleId}: no contributions paid — skipping payout`);
      return { skipped: true, reason: 'no contributions paid' };
    }

    // Create payout record and initiate Paystack transfer
    const payoutRef = `sched_${cycleId.slice(-8)}_${Date.now()}`;

    const payout = await this.prisma.payout.create({
      data: {
        cycleId,
        recipientId: cycle.recipientId,
        amount: payoutAmountNgn,
        status: PayoutStatus.PENDING,
        initiatedAt: new Date(),
      },
    });

    const { transferCode } = await this.paystack.initiateTransfer({
      amountNgn: payoutAmountNgn,
      recipientCode: `rcpt_${cycle.recipientId}`,
      reference: payoutRef,
      reason: `Poolr payout — cycle ${cycle.cycleNumber}`,
    });

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.payout.update({
        where: { id: payout.id },
        data: { paystackTransferCode: transferCode, status: PayoutStatus.INITIATED },
      });
      await tx.cycle.update({
        where: { id: cycleId },
        data: { status: CycleStatus.ACTIVE },
      });
    });

    const event: PayoutInitiatedEvent = {
      cycleId,
      recipientId: cycle.recipientId,
      amountNgn: payoutAmountNgn,
      transferCode,
    };
    this.eventEmitter.emit(PAYOUT_EVENTS.INITIATED, event);

    this.logger.log(`Cycle ${cycleId}: payout initiated — ${transferCode}, ${payoutAmountNgn} NGN`);
    return { transferCode, amountNgn: payoutAmountNgn };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<PayoutJobData> | undefined, error: Error): Promise<void> {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return; // will be retried

    this.logger.error(
      `Payout job permanently failed for cycle ${job.data.cycleId} after ${job.attemptsMade} attempt(s): ${error.message}`,
    );

    // Notify group admin via Notification record
    try {
      const cycle = await this.prisma.cycle.findUnique({
        where: { id: job.data.cycleId },
        include: { group: { select: { adminId: true, name: true } } },
      });

      if (cycle) {
        await this.prisma.notification.create({
          data: {
            userId: cycle.group.adminId,
            title: 'Payout Failed',
            body: `Payout for cycle ${cycle.cycleNumber} in "${cycle.group.name}" failed after ${job.attemptsMade} attempts. Manual action required.`,
            channel: NotifChannel.IN_APP,
          },
        });

        const event: PayoutDeadLetteredEvent = {
          cycleId: job.data.cycleId,
          recipientId: job.data.recipientId,
          groupAdminId: cycle.group.adminId,
          cycleNumber: cycle.cycleNumber,
          error: error.message,
        };
        this.eventEmitter.emit(PAYOUT_EVENTS.DEAD_LETTERED, event);
      }
    } catch (notifyErr) {
      this.logger.error(`Failed to send dead-letter notification: ${(notifyErr as Error).message}`);
    }
  }

  private async applyPenalties(
    cycleId: string,
    unpaidContributions: Array<{ id: string; memberId: string; amount: unknown }>,
  ): Promise<void> {
    const penaltyPercent = this.config.get<number>('LATE_PAYMENT_PENALTY_PERCENT', 5);

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const contrib of unpaidContributions) {
        await tx.contribution.update({
          where: { id: contrib.id },
          data: { status: ContribStatus.OVERDUE },
        });
        await tx.penalty.create({
          data: {
            contributionId: contrib.id,
            memberId: contrib.memberId,
            penaltyAmount: Number(contrib.amount) * (penaltyPercent / 100),
            reason: PenaltyReason.LATE_PAYMENT,
            status: PenaltyStatus.PENDING,
          },
        });
      }
    });
  }
}
