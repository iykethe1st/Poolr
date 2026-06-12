import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyKycDto {
  @ApiProperty({ description: 'Dojah reference_id from the widget success callback' })
  @IsString()
  @IsNotEmpty()
  referenceId!: string;
}
