import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TxDirection, TxType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PaystackService } from '../payments/paystack.service';

const WALLET_TTL = 60 * 60 * 24 * 30; // 30 days

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly paystack: PaystackService,
    private readonly config: ConfigService,
  ) {}

  async getWallet(userId: string) {
    // Create wallet lazily if it doesn't exist yet
    return this.prisma.wallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async listTransactions(userId: string, page: number, limit: number) {
    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async topUp(userId: string, amountNgn: number) {
    const reference = `topup_${userId.slice(-8)}_${Date.now()}`;
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3003');

    const { authorizationUrl } = await this.paystack.initializeTransaction({
      email: user.email,
      amountNgn,
      reference,
      callbackUrl: `${frontendUrl}/payments/callback`,
      metadata: { type: 'topup', userId },
    });

    return { authorizationUrl, reference };
  }

  async verifyTopUp(userId: string, reference: string) {
    const result = await this.paystack.verifyTransaction(reference);

    if (result.status !== 'success') {
      return { status: result.status };
    }

    const amountNgn = result.amountKobo / 100;

    // Idempotency: if wallet transaction already exists, it was already credited
    const existing = await this.prisma.walletTransaction.findUnique({ where: { reference } });
    if (existing) {
      return { status: 'success', amountNgn };
    }

    await this.credit(userId, amountNgn, reference, TxType.TOPUP);

    return { status: 'success', amountNgn };
  }

  async withdraw(userId: string, amountNgn: number) {
    const bankAccount = await this.prisma.bankAccount.findUnique({ where: { userId } });
    if (!bankAccount) {
      throw new BadRequestException(
        'No bank account registered. Add a bank account in Settings first.',
      );
    }

    const withdrawRef = `withdraw_${userId.slice(-8)}_${Date.now()}`;

    // Debit wallet atomically (includes balance check + optimistic locking)
    await this.debit(userId, amountNgn, withdrawRef, TxType.WITHDRAWAL);

    try {
      const { transferCode } = await this.paystack.initiateTransfer({
        amountNgn,
        recipientCode: bankAccount.paystackRecipientCode,
        reference: withdrawRef,
        reason: 'Poolr wallet withdrawal',
      });

      // Store transfer→withdrawal mapping so handleTransferFailed can reverse if needed
      await this.redis.set(
        `wallet:withdraw:transfer:${transferCode}`,
        JSON.stringify({ userId, amount: amountNgn, reference: withdrawRef }),
        WALLET_TTL,
      );

      return { reference: withdrawRef, transferCode };
    } catch (err) {
      // Transfer initiation failed — reverse the debit so user doesn't lose funds
      await this.credit(userId, amountNgn, `reversal_${withdrawRef}`, TxType.REVERSAL).catch((e: Error) =>
        this.logger.error(`Failed to reverse withdrawal debit for ${userId}: ${e.message}`),
      );
      throw err;
    }
  }

  async credit(
    userId: string,
    amount: number,
    reference: string,
    type: TxType,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (tx) {
      return this.applyBalanceChange(tx, userId, amount, TxDirection.CREDIT, reference, type);
    }
    await this.updateBalanceWithRetry(userId, amount, TxDirection.CREDIT, reference, type);
  }

  async debit(
    userId: string,
    amount: number,
    reference: string,
    type: TxType,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (tx) {
      return this.applyBalanceChange(tx, userId, amount, TxDirection.DEBIT, reference, type);
    }
    await this.updateBalanceWithRetry(userId, amount, TxDirection.DEBIT, reference, type);
  }

  // ── Optimistic-locking retry loop (standalone calls only) ─────────────────

  private async updateBalanceWithRetry(
    userId: string,
    amount: number,
    direction: TxDirection,
    reference: string,
    type: TxType,
  ): Promise<void> {
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });

      if (direction === TxDirection.DEBIT && Number(wallet.balance) < amount) {
        throw new UnprocessableEntityException(
          `Insufficient balance: ₦${Number(wallet.balance).toFixed(2)} available, ₦${amount.toFixed(2)} requested`,
        );
      }

      let versionConflict = false;

      try {
        await this.prisma.$.$transaction(async (tx) => {
          const updated = await tx.wallet.updateMany({
            where: { id: wallet.id, version: wallet.version },
            data: {
              balance: direction === TxDirection.CREDIT
                ? { increment: amount }
                : { decrement: amount },
              version: { increment: 1 },
            },
          });

          if (updated.count === 0) {
            versionConflict = true;
            throw new Error('OPTIMISTIC_CONFLICT');
          }

          await tx.walletTransaction.create({
            data: { walletId: wallet.id, amount, type, direction, reference },
          });
        });

        return;
      } catch (err) {
        if (versionConflict && attempt < MAX_RETRIES - 1) {
          this.logger.debug(`Wallet version conflict for user ${userId}, retrying (attempt ${attempt + 1})`);
          continue;
        }
        if (versionConflict) {
          throw new ConflictException('Wallet update conflict after maximum retries');
        }
        throw err;
      }
    }
  }

  // ── Inline execution inside a caller-provided transaction ─────────────────

  private async applyBalanceChange(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    direction: TxDirection,
    reference: string,
    type: TxType,
  ): Promise<void> {
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });

    if (direction === TxDirection.DEBIT && Number(wallet.balance) < amount) {
      throw new UnprocessableEntityException(
        `Insufficient balance: ₦${Number(wallet.balance).toFixed(2)} available, ₦${amount.toFixed(2)} requested`,
      );
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: direction === TxDirection.CREDIT
          ? { increment: amount }
          : { decrement: amount },
        version: { increment: 1 },
      },
    });

    await tx.walletTransaction.create({
      data: { walletId: wallet.id, amount, type, direction, reference },
    });
  }
}
