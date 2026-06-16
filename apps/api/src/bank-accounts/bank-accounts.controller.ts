import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { KycGuard } from '../common/guards/kyc.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BankAccountsService } from './bank-accounts.service';
import { ResolveAccountDto } from './dto/resolve-account.dto';
import { SaveBankAccountDto } from './dto/save-bank-account.dto';

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('bank-accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly bankAccounts: BankAccountsService) {}

  @Get('banks')
  @ApiOperation({ summary: 'List all supported Nigerian banks' })
  listBanks() {
    return this.bankAccounts.listBanks();
  }

  @Post('resolve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resolve an account number to get the account holder name' })
  resolve(@Body() dto: ResolveAccountDto) {
    return this.bankAccounts.resolveAccount(dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current saved bank account' })
  getMyAccount(@CurrentUser() user: AuthUser) {
    return this.bankAccounts.getMyAccount(user.id);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(KycGuard)
  @ApiOperation({ summary: 'Save bank account (KYC required)' })
  save(@CurrentUser() user: AuthUser, @Body() dto: SaveBankAccountDto) {
    return this.bankAccounts.save(user.id, dto);
  }

  @Delete('me')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove saved bank account' })
  remove(@CurrentUser() user: AuthUser) {
    return this.bankAccounts.remove(user.id);
  }
}
