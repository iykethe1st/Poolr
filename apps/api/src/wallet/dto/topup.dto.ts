import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TopUpDto {
  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(100)
  amountNgn!: number;
}
