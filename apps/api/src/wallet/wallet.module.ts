import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PaystackService } from '../payments/paystack.service';
import { FeeService } from '../payments/fee.service';

@Module({
  controllers: [WalletController],
  providers: [WalletService, PaystackService, FeeService],
  exports: [WalletService],
})
export class WalletModule {}
