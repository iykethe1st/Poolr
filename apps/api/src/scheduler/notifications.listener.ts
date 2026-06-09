import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotifChannel } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  PAYOUT_EVENTS,
  PayoutDeadLetteredEvent,
  PayoutInitiatedEvent,
} from './events/payout.events';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(PAYOUT_EVENTS.INITIATED)
  async onPayoutInitiated(event: PayoutInitiatedEvent): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: event.recipientId,
        title: 'Payout on the way!',
        body: `Your payout of ₦${event.amountNgn.toLocaleString()} has been initiated and is on its way to your account.`,
        channel: NotifChannel.IN_APP,
      },
    });
    this.logger.log(`Sent payout.initiated notification to ${event.recipientId}`);
  }

  @OnEvent(PAYOUT_EVENTS.DEAD_LETTERED)
  async onPayoutDeadLettered(event: PayoutDeadLetteredEvent): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: event.groupAdminId,
        title: 'Urgent: Payout Failed',
        body: `Payout for cycle ${event.cycleNumber} has failed after multiple retries and requires your attention. Error: ${event.error}`,
        channel: NotifChannel.IN_APP,
      },
    });
    this.logger.warn(`Dead-letter notification sent to admin ${event.groupAdminId} for cycle ${event.cycleId}`);
  }
}
