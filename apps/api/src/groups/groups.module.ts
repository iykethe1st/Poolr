import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { RotationService } from './rotation.service';
import { TermiiService } from '../auth/termii.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [GroupsController],
  providers: [GroupsService, RotationService, TermiiService],
  exports: [GroupsService],
})
export class GroupsModule {}
