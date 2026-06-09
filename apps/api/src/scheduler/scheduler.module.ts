import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsModule } from '../payments/payments.module';
import { PayoutProcessor } from './payout.processor';
import { PayoutScheduler } from './payout.scheduler';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'payout' }),
    PaymentsModule,
  ],
  providers: [PayoutProcessor, PayoutScheduler],
})
export class SchedulerModule {}
