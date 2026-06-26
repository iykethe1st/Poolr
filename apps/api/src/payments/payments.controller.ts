import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { InitiateContributionDto } from './dto/initiate-contribution.dto';

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('contribute/:cycleId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Initiate a cycle contribution via Paystack checkout or wallet balance' })
  contribute(
    @Param('cycleId') cycleId: string,
    @Body() dto: InitiateContributionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.initializeContribution(user.id, cycleId, dto.paymentSource, dto.callbackUrl);
  }

  @Get('verify/:reference')
  @ApiOperation({ summary: 'Verify a Paystack payment by reference' })
  verify(@Param('reference') reference: string, @CurrentUser() user: AuthUser) {
    return this.payments.verifyPayment(user.id, reference);
  }

  @Get('contributions')
  @ApiOperation({ summary: 'List own contributions' })
  listContributions(@CurrentUser() user: AuthUser) {
    return this.payments.listContributions(user.id);
  }

  @Get('payouts')
  @ApiOperation({ summary: 'List own payouts' })
  listPayouts(@CurrentUser() user: AuthUser) {
    return this.payments.listPayouts(user.id);
  }

  @Get('next-payout')
  @ApiOperation({ summary: 'Get the next scheduled payout for the current user' })
  getNextPayout(@CurrentUser() user: AuthUser) {
    return this.payments.getNextPayout(user.id);
  }
}
