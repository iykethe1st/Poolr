import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { DebtStatus, UserStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DefaultProtectionService } from './default-protection.service';
import { PaystackService } from '../payments/paystack.service';

@Injectable()
export class DebtClearanceService {
  private readonly logger = new Logger(DebtClearanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly defaultProtection: DefaultProtectionService,
    private readonly paystack: PaystackService,
  ) {}

  async listDebts(filters?: { userId?: string; status?: DebtStatus }) {
    return this.prisma.debt.findMany({
      where: {
        ...(filters?.userId ? { userId: filters.userId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        cycle: { select: { id: true, cycleNumber: true, group: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDebt(debtId: string) {
    const debt = await this.prisma.debt.findUnique({
      where: { id: debtId },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        cycle: { select: { id: true, cycleNumber: true, group: { select: { id: true, name: true } } } },
      },
    });
    if (!debt) throw new NotFoundException('Debt not found');
    return debt;
  }

  /** Generate a Paystack payment link for a debt and store it on the record. */
  async generatePaymentLink(debtId: string): Promise<{ paymentLink: string; paymentRef: string }> {
    const debt = await this.getDebt(debtId);

    if (debt.status === DebtStatus.CLEARED) {
      throw new BadRequestException('Debt is already cleared');
    }

    const paymentRef = `debt_${debtId}_${Date.now()}`;
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://app.poolr.ng');

    const { authorizationUrl } = await this.paystack.initializeTransaction({
      amountNgn: Number(debt.amountNgn),
      email: debt.user.email,
      reference: paymentRef,
      callbackUrl: `${frontendUrl}/debt-cleared?ref=${paymentRef}`,
      metadata: { debtId, userId: debt.userId, cycleId: debt.cycleId },
    });

    await this.prisma.debt.update({
      where: { id: debtId },
      data: { paymentLink: authorizationUrl, paymentRef },
    });

    return { paymentLink: authorizationUrl, paymentRef };
  }

  /** Called when Paystack confirms debt payment (from webhook). */
  async handleDebtPaymentSuccess(paymentRef: string): Promise<void> {
    const debt = await this.prisma.debt.findUnique({ where: { paymentRef } });
    if (!debt) {
      this.logger.warn(`handleDebtPaymentSuccess: no debt for ref ${paymentRef}`);
      return;
    }
    if (debt.status === DebtStatus.CLEARED) {
      this.logger.log(`Debt ${debt.id} already cleared, skipping`);
      return;
    }

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.debt.update({
        where: { id: debt.id },
        data: { status: DebtStatus.CLEARED, clearedAt: new Date() },
      });
    });

    // If the user was FROZEN (pre-payout scenario), lift the freeze and release payout
    const user = await this.prisma.user.findUnique({ where: { id: debt.userId } });
    if (user?.status === UserStatus.FROZEN) {
      await this.defaultProtection.liftFreeze(debt.userId, debt.cycleId);
    }

    this.logger.log(`Debt ${debt.id} cleared for user ${debt.userId}`);
  }

  @OnEvent('debt.payment.success')
  async onDebtPaymentSuccess(payload: { reference: string }): Promise<void> {
    await this.handleDebtPaymentSuccess(payload.reference).catch((err: unknown) => {
      this.logger.error(`Failed to process debt payment ${payload.reference}: ${(err as Error).message}`);
    });
  }

  /** Admin: manually lift a ban after debt is settled out-of-band. */
  async adminLiftBan(userId: string, adminId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== UserStatus.BANNED) {
      throw new BadRequestException('User is not banned');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });

    await this.prisma.banRecord.updateMany({
      where: { userId },
      data: { notes: `Ban lifted by admin ${adminId}` },
    });

    this.logger.log(`Ban lifted for user ${userId} by admin ${adminId}`);
    return { message: 'Ban lifted successfully' };
  }
}
