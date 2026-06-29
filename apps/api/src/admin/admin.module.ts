import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PaymentsModule } from '../payments/payments.module';
import { ProtectionModule } from '../protection/protection.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'payout' }), PaymentsModule, ProtectionModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
