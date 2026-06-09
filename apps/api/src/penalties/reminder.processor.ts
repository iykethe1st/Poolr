import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ContribStatus, NotifChannel } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ReminderJobData } from './reminder-job';

@Processor('reminder')
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<void> {
    const { contributionId, memberId, groupName, dueDate, hoursRemaining } = job.data;

    const contribution = await this.prisma.contribution.findUnique({
      where: { id: contributionId },
    });

    if (!contribution || contribution.status !== ContribStatus.PENDING) {
      this.logger.debug(
        `Reminder skipped: contribution ${contributionId} is no longer PENDING`,
      );
      return;
    }

    const member = await this.prisma.groupMember.findUnique({ where: { id: memberId } });
    if (!member) return;

    const dueFormatted = new Date(dueDate).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const isDueToday = hoursRemaining === 0;
    const title = isDueToday ? 'Contribution Due Today!' : 'Contribution Reminder';
    const body = isDueToday
      ? `Your contribution for "${groupName}" is due today (${dueFormatted}). Pay now to avoid a penalty.`
      : `Your contribution for "${groupName}" is due in ${hoursRemaining} hours (${dueFormatted}).`;

    await this.prisma.notification.create({
      data: {
        userId: member.userId,
        title,
        body,
        channel: NotifChannel.IN_APP,
      },
    });

    this.logger.log(
      `Sent ${isDueToday ? 'due-day' : `${hoursRemaining}h`} reminder for contribution ${contributionId}`,
    );
  }
}
