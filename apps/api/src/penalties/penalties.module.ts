import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PenaltiesController } from './penalties.controller';
import { PenaltiesService } from './penalties.service';
import { ReminderProcessor } from './reminder.processor';
import { ReminderScheduler } from './reminder.scheduler';
import { ProtectionModule } from '../protection/protection.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'reminder' }), ProtectionModule],
  controllers: [PenaltiesController],
  providers: [PenaltiesService, ReminderProcessor, ReminderScheduler],
  exports: [PenaltiesService],
})
export class PenaltiesModule {}
