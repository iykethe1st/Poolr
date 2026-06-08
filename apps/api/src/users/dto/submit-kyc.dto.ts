import { IsDateString, IsOptional, IsString, Length, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitKycDto {
  @ApiPropertyOptional({ description: 'Bank Verification Number (11 digits)' })
  @IsOptional()
  @IsString()
  @Length(11, 11)
  bvn?: string;

  @ApiPropertyOptional({ description: 'National Identification Number (11 digits)' })
  @IsOptional()
  @IsString()
  @Length(11, 11)
  nin?: string;

  @ApiPropertyOptional({ example: '1990-01-15' })
  @IsDateString()
  dateOfBirth!: string;

  @ValidateIf((o: SubmitKycDto) => !o.bvn && !o.nin)
  @IsString({ message: 'At least one of bvn or nin is required' })
  readonly _requireBvnOrNin?: never;
}
