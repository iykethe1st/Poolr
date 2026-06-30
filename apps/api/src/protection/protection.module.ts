import { Module } from '@nestjs/common';
import { DefaultProtectionService } from './default-protection.service';
import { DebtClearanceService } from './debt-clearance.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  providers: [DefaultProtectionService, DebtClearanceService],
  exports: [DefaultProtectionService, DebtClearanceService],
})
export class ProtectionModule {}
