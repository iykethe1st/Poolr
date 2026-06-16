import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency, Frequency } from '@prisma/client';

export class CreateGroupDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Amount each member contributes per cycle (NGN)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(100)
  contributionAmount!: number;

  @ApiProperty({ enum: Frequency })
  @IsEnum(Frequency)
  frequency!: Frequency;

  @ApiProperty({ minimum: 3, maximum: 50 })
  @IsInt()
  @Min(3)
  @Max(50)
  maxMembers!: number;

  @ApiPropertyOptional({ enum: Currency, default: 'NGN' })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: { enabled: true, percentage: 5 } })
  @IsOptional()
  @IsObject()
  penaltyConfig?: Record<string, unknown>;
}
