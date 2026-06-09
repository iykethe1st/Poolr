import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import { ContribStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ReminderJobData } from './reminder-job';
import {
  NOTIFICATION_EVENTS,
  ContributionReminderEvent,
} from '../notifications/events/notification.events';

@Processor('reminder')
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {
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

    const evt: ContributionReminderEvent = {
      userId: member.userId,
      groupName,
      dueDate,
      hoursRemaining,
      amountNgn: Number(contribution.amount),
    };
    this.eventEmitter.emit(NOTIFICATION_EVENTS.CONTRIBUTION_REMINDER, evt);

    this.logger.log(
      `Reminder event emitted (${hoursRemaining}h) for contribution ${contributionId}`,
    );
  }
}
