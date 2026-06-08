import { IsEmail, IsOptional, IsPhoneNumber, IsString, ValidateIf } from 'class-validator';
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

  @ValidateIf((o: InviteMemberDto) => !o.phone && !o.email)
  @IsString({ message: 'At least one of phone or email is required' })
  readonly _require?: never;
}
