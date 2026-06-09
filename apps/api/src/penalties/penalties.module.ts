import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PenaltiesController } from './penalties.controller';
import { PenaltiesService } from './penalties.service';
import { ReminderProcessor } from './reminder.processor';
import { ReminderScheduler } from './reminder.scheduler';

@Module({
  imports: [BullModule.registerQueue({ name: 'reminder' })],
  controllers: [PenaltiesController],
  providers: [PenaltiesService, ReminderProcessor, ReminderScheduler],
  exports: [PenaltiesService],
})
export class PenaltiesModule {}
