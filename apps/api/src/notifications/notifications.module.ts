import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';

@Module({
  controllers: [NotificationsController],
  providers: [
    PushService,
    EmailService,
    SmsService,
    NotificationsService,
    NotificationsListener,
  ],
  exports: [NotificationsService, EmailService, SmsService, PushService],
})
export class NotificationsModule {}
