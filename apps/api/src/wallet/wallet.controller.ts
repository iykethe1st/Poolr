import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WalletService } from './wallet.service';
import { FeeService } from '../payments/fee.service';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { TopUpDto } from './dto/topup.dto';
import { WithdrawDto } from './dto/withdraw.dto';

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly feeService: FeeService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get own wallet balance' })
  getWallet(@CurrentUser() user: { id: string }) {
    return this.walletService.getWallet(user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Paginated wallet transaction history' })
  listTransactions(
    @CurrentUser() user: { id: string },
    @Query() dto: ListTransactionsDto,
  ) {
    return this.walletService.listTransactions(user.id, dto.page ?? 1, dto.limit ?? 20);
  }

  @Post('topup')
  @ApiOperation({ summary: 'Initialize Paystack top-up for wallet' })
  topUp(@CurrentUser() user: { id: string }, @Body() dto: TopUpDto) {
    return this.walletService.topUp(user.id, dto.amountNgn, dto.callbackUrl);
  }

  @Get('topup/verify/:reference')
  @ApiOperation({ summary: 'Verify wallet top-up after Paystack callback' })
  verifyTopUp(
    @CurrentUser() user: { id: string },
    @Param('reference') reference: string,
  ) {
    return this.walletService.verifyTopUp(user.id, reference);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw from wallet to registered bank account' })
  withdraw(@CurrentUser() user: { id: string }, @Body() dto: WithdrawDto) {
    return this.walletService.withdraw(user.id, dto.amountNgn);
  }

  @Get('can-pay/:cycleId')
  @ApiOperation({ summary: 'Check if wallet balance covers contribution + platform fee for a cycle' })
  async canPay(
    @CurrentUser() user: { id: string },
    @Param('cycleId') cycleId: string,
  ) {
    return this.walletService.canPayFromWallet(user.id, cycleId, this.feeService);
  }
}
