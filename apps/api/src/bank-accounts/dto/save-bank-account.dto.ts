import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class SaveBankAccountDto {
  @ApiProperty({ example: '058' })
  @IsString()
  bankCode!: string;

  @ApiProperty({ example: 'Guaranty Trust Bank' })
  @IsString()
  bankName!: string;

  @ApiProperty({ example: '0123456789' })
  @IsString()
  @Length(10, 10, { message: 'Account number must be exactly 10 digits' })
  @Matches(/^\d{10}$/, { message: 'Account number must contain only digits' })
  accountNumber!: string;

  @ApiProperty({ example: 'JOHN DOE' })
  @IsString()
  accountName!: string;
}
