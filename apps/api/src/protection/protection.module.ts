import { Module } from '@nestjs/common';
import { DefaultProtectionService } from './default-protection.service';
import { DebtClearanceService } from './debt-clearance.service';
import { TrustScoreService } from '../users/trust-score.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  providers: [DefaultProtectionService, DebtClearanceService, TrustScoreService],
  exports: [DefaultProtectionService, DebtClearanceService, TrustScoreService],
})
export class ProtectionModule {}
