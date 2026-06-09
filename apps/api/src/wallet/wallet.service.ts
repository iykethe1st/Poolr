import {
  ConflictException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TxDirection, TxType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string) {
    return this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
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
          // Optimistic lock: only update if nobody else incremented the version
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
