import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WithdrawDto {
  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(100)
  amountNgn!: number;
}
