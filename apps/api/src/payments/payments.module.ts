import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { WebhookController } from './webhook.controller';
import { PaymentsService } from './payments.service';
import { PaystackService } from './paystack.service';
import { FeeService } from './fee.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [PaymentsController, WebhookController],
  providers: [PaymentsService, PaystackService, FeeService],
  exports: [PaymentsService, PaystackService, FeeService],
})
export class PaymentsModule {}
