import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { ContribStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ReminderJobData } from './reminder-job';

@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(
    @InjectQueue('reminder') private readonly reminderQueue: Queue<ReminderJobData>,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduleReminders(): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 49 * 3_600_000);

    const contributions = await this.prisma.contribution.findMany({
      where: {
        status: ContribStatus.PENDING,
        dueAt: { gte: now, lte: cutoff },
      },
      include: { member: true, cycle: { include: { group: true } } },
    });

    if (contributions.length === 0) return;
    this.logger.log(
      `Scheduling reminders for ${contributions.length} contribution(s) due in next 48h`,
    );

    for (const contrib of contributions) {
      const due = contrib.dueAt.getTime();
      const nowMs = now.getTime();
      const base: Omit<ReminderJobData, 'hoursRemaining'> = {
        contributionId: contrib.id,
        memberId: contrib.memberId,
        cycleId: contrib.cycleId,
        groupName: contrib.cycle.group.name,
        dueDate: contrib.dueAt.toISOString(),
      };

      const delay48 = due - 48 * 3_600_000 - nowMs;
      if (delay48 > 0) {
        await this.reminderQueue.add(
          'reminder',
          { ...base, hoursRemaining: 48 },
          { jobId: `reminder_48h_${contrib.id}`, delay: delay48 },
        );
      }

      const delay24 = due - 24 * 3_600_000 - nowMs;
      if (delay24 > 0) {
        await this.reminderQueue.add(
          'reminder',
          { ...base, hoursRemaining: 24 },
          { jobId: `reminder_24h_${contrib.id}`, delay: delay24 },
        );
      }

      const delayDue = due - nowMs;
      if (delayDue > 0) {
        await this.reminderQueue.add(
          'reminder',
          { ...base, hoursRemaining: 0 },
          { jobId: `reminder_due_${contrib.id}`, delay: delayDue },
        );
      }
    }
  }
}
