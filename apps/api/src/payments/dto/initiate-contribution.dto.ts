import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentSource {
  PAYSTACK = 'PAYSTACK',
  WALLET = 'WALLET',
}

export class InitiateContributionDto {
  @ApiPropertyOptional({
    enum: PaymentSource,
    default: PaymentSource.PAYSTACK,
    description: 'PAYSTACK (default) initiates Paystack checkout; WALLET debits the member\'s Poolr wallet balance immediately',
  })
  @IsOptional()
  @IsEnum(PaymentSource)
  paymentSource?: PaymentSource;

  @ApiPropertyOptional({
    description: 'Override Paystack callback URL (e.g. a mobile deep-link like poolr://payment-callback)',
  })
  @IsOptional()
  @IsString()
  callbackUrl?: string;
}
