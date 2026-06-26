import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TopUpDto {
  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(100)
  amountNgn!: number;

  @ApiPropertyOptional({
    description: 'Override Paystack callback URL (e.g. a mobile deep-link like poolr://topup-callback)',
  })
  @IsOptional()
  @IsString()
  callbackUrl?: string;
}
