import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinGroupDto {
  @ApiProperty({ description: 'Invite token received via SMS or email' })
  @IsString()
  @Length(64, 64)
  token!: string;
}
