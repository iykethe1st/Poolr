import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CycleStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PayoutJobData } from './events/payout.events';

@Injectable()
export class PayoutScheduler {
  private readonly logger = new Logger(PayoutScheduler.name);

  constructor(
    @InjectQueue('payout') private readonly payoutQueue: Queue<PayoutJobData>,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduleDailyPayouts(): Promise<void> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const cycles = await this.prisma.cycle.findMany({
      where: {
        dueDate: { gte: startOfDay, lte: endOfDay },
        status: CycleStatus.PENDING,
      },
      include: { group: { select: { id: true } } },
    });

    if (cycles.length === 0) {
      this.logger.debug('No cycles due today');
      return;
    }

    this.logger.log(`Scheduling payout jobs for ${cycles.length} cycle(s) due today`);

    for (const cycle of cycles) {
      await this.payoutQueue.add(
        'disburse',
        {
          cycleId: cycle.id,
          recipientId: cycle.recipientId,
          groupId: cycle.groupId,
        },
        {
          jobId: `payout_${cycle.id}`, // deduplication key
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { age: 24 * 3600 },
          removeOnFail: false,
        },
      );
      this.logger.debug(`Enqueued payout job for cycle ${cycle.id}`);
    }
  }
}
