import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'payout' })],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
