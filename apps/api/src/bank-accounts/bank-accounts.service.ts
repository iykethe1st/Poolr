import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PayoutStatus, TxType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PaystackService } from '../payments/paystack.service';
import { WalletService } from '../wallet/wallet.service';
import {
  NOTIFICATION_EVENTS,
  PayoutReceivedEvent,
} from '../notifications/events/notification.events';
import type { SaveBankAccountDto } from './dto/save-bank-account.dto';
import type { ResolveAccountDto } from './dto/resolve-account.dto';

const BANKS_CACHE_KEY = 'paystack:banks';
const BANKS_TTL = 60 * 60 * 24; // 24 hours

@Injectable()
export class BankAccountsService {
  private readonly logger = new Logger(BankAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly paystack: PaystackService,
    private readonly walletService: WalletService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listBanks() {
    const cached = await this.redis.get(BANKS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as Array<{ name: string; code: string; slug: string }>;
    }

    const banks = await this.paystack.listBanks();
    await this.redis.set(BANKS_CACHE_KEY, JSON.stringify(banks), BANKS_TTL);
    return banks;
  }

  async resolveAccount(dto: ResolveAccountDto) {
    if (dto.accountNumber.length !== 10 || !/^\d+$/.test(dto.accountNumber)) {
      throw new BadRequestException('Account number must be exactly 10 digits');
    }
    try {
      return await this.paystack.resolveAccount(dto.bankCode, dto.accountNumber);
    } catch {
      throw new BadRequestException('Could not resolve account. Check the bank and account number.');
    }
  }

  async save(userId: string, dto: SaveBankAccountDto) {
    const existing = await this.prisma.bankAccount.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('You already have a saved bank account. Remove it before adding a new one.');
    }

    const { recipientCode } = await this.paystack.createTransferRecipient({
      name: dto.accountName,
      accountNumber: dto.accountNumber,
      bankCode: dto.bankCode,
    });

    const account = await this.prisma.bankAccount.create({
      data: {
        userId,
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        accountName: dto.accountName,
        paystackRecipientCode: recipientCode,
      },
    });

    this.logger.log(`Bank account saved for user ${userId}: ${dto.bankName} ${dto.accountNumber}`);

    // Dispatch any payouts that were held pending bank account registration.
    // Awaited synchronously so the DB is updated before the HTTP response returns —
    // the frontend refetch then sees INITIATED, not PENDING.
    await this.dispatchHeldPayouts(userId).catch((err: Error) =>
      this.logger.error(`Failed to dispatch held payouts for user ${userId}: ${err.message}`),
    );

    return account;
  }

  private async dispatchHeldPayouts(userId: string): Promise<void> {
    const pending = await this.prisma.payout.findMany({
      where: { recipientId: userId, status: PayoutStatus.PENDING },
      include: { cycle: { select: { cycleNumber: true, group: { select: { name: true } } } } },
    });

    if (pending.length === 0) return;

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, fullName: true },
    });

    for (const payout of pending) {
      try {
        const amountNgn = Number(payout.amount);
        const payoutRef = `payout_held_${payout.id.slice(-8)}_${Date.now()}`;
        const now = new Date();

        await this.prisma.$.$transaction(async (tx) => {
          await tx.payout.update({
            where: { id: payout.id },
            data: { status: PayoutStatus.COMPLETED, completedAt: now },
          });
          await this.walletService.credit(userId, amountNgn, payoutRef, TxType.PAYOUT, tx);
        });

        const evt: PayoutReceivedEvent = {
          userId,
          email: user.email,
          fullName: user.fullName,
          amountNgn,
          groupName: payout.cycle.group.name,
        };
        this.eventEmitter.emit(NOTIFICATION_EVENTS.PAYOUT_RECEIVED, evt);

        this.logger.log(`Settled held payout ${payout.id} → ₦${amountNgn} credited to wallet for user ${userId}`);
      } catch (err: unknown) {
        this.logger.error(`Failed to dispatch held payout ${payout.id}: ${(err as Error).message}`);
      }
    }
  }

  async getMyAccount(userId: string) {
    return this.prisma.bankAccount.findUnique({ where: { userId } });
  }

  async remove(userId: string) {
    const account = await this.prisma.bankAccount.findUnique({ where: { userId } });
    if (!account) throw new NotFoundException('No bank account found');

    await this.prisma.bankAccount.delete({ where: { userId } });
    this.logger.log(`Bank account removed for user ${userId}`);
    return { message: 'Bank account removed' };
  }
}
