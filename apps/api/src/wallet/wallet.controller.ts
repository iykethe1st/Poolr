import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { WalletService } from './wallet.service';
import { ListTransactionsDto } from './dto/list-transactions.dto';

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get own wallet balance' })
  getWallet(@CurrentUser() user: JwtPayload) {
    return this.walletService.getWallet(user.sub);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Paginated wallet transaction history' })
  listTransactions(
    @CurrentUser() user: JwtPayload,
    @Query() dto: ListTransactionsDto,
  ) {
    return this.walletService.listTransactions(user.sub, dto.page ?? 1, dto.limit ?? 20);
  }
}
