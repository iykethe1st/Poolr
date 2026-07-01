import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DojahService } from './dojah.service';
import { DojahWebhookController } from './dojah-webhook.controller';
import { KycWidgetController } from './kyc-widget.controller';
import { TrustScoreService } from './trust-score.service';
import { ProtectionModule } from '../protection/protection.module';

@Module({
  imports: [ProtectionModule],
  controllers: [UsersController, DojahWebhookController, KycWidgetController],
  providers: [UsersService, DojahService, TrustScoreService],
  exports: [UsersService, TrustScoreService],
})
export class UsersModule {}
