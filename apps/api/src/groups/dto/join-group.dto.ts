import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JoinGroupDto {
  @ApiProperty({ description: 'Invite token received via SMS or email' })
  @IsString()
  @Length(64, 64)
  token!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 3, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  slotCount?: number;
}
