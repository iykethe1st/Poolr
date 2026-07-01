import { IsEmail, IsInt, IsOptional, IsPhoneNumber, IsString, Max, Min, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class InviteMemberDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Number of rotation slots to allocate. Defaults to 1. Capped by the user's trust tier. */
  @ApiPropertyOptional({ minimum: 1, maximum: 3, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  slotCount?: number;

  @ValidateIf((o: InviteMemberDto) => !o.phone && !o.email)
  @IsString({ message: 'At least one of phone or email is required' })
  readonly _require?: never;
}
