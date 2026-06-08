import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';

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
  @ApiOperation({ summary: 'Initialise Paystack transaction for a cycle contribution' })
  contribute(@Param('cycleId') cycleId: string, @CurrentUser() user: AuthUser) {
    return this.payments.initializeContribution(user.id, cycleId);
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
}
