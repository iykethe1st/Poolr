import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { RotationService } from './rotation.service';
import { SlotService } from './slot.service';
import { TermiiService } from '../auth/termii.service';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PaymentsModule, UsersModule],
  controllers: [GroupsController],
  providers: [GroupsService, RotationService, SlotService, TermiiService],
  exports: [GroupsService, SlotService],
})
export class GroupsModule {}
