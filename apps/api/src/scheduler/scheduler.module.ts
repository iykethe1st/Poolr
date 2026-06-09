import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsModule } from '../payments/payments.module';
import { PayoutProcessor } from './payout.processor';
import { PayoutScheduler } from './payout.scheduler';
import { NotificationsListener } from './notifications.listener';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'payout' }),
    PaymentsModule,
  ],
  providers: [PayoutProcessor, PayoutScheduler, NotificationsListener],
})
export class SchedulerModule {}
