import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TxDirection, TxType } from '@prisma/client';
import { WalletService } from './wallet.service';
import { PrismaService } from '../database/prisma.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-1';
const WALLET_ID = 'wallet-1';

const MOCK_WALLET = {
  id: WALLET_ID,
  userId: USER_ID,
  balance: 10_000,
  currency: 'NGN',
  version: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_TX = {
  id: 'tx-1',
  walletId: WALLET_ID,
  amount: 5_000,
  type: TxType.CONTRIBUTION,
  direction: TxDirection.CREDIT,
  reference: 'ref-1',
  createdAt: new Date(),
};

function makePrismaMock() {
  const txClient = {
    wallet: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(MOCK_WALLET),
      update: jest.fn().mockResolvedValue(MOCK_WALLET),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    walletTransaction: {
      create: jest.fn().mockResolvedValue(MOCK_TX),
    },
  };

  return {
    wallet: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(MOCK_WALLET),
    },
    walletTransaction: {
      findMany: jest.fn().mockResolvedValue([MOCK_TX]),
      count: jest.fn().mockResolvedValue(1),
    },
    $: {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof txClient) => unknown) => fn(txClient)),
    },
    _txClient: txClient,
  };
}

describe('WalletService', () => {
  let service: WalletService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(WalletService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getWallet ─────────────────────────────────────────────────────────────

  describe('getWallet', () => {
    it('returns the wallet for the given userId', async () => {
      const result = await service.getWallet(USER_ID);
      expect(result).toEqual(MOCK_WALLET);
      expect(prisma.wallet.findUniqueOrThrow).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    });
  });

  // ── listTransactions ──────────────────────────────────────────────────────

  describe('listTransactions', () => {
    it('returns paginated transactions with metadata', async () => {
      const result = await service.listTransactions(USER_ID, 1, 20);

      expect(result.items).toEqual([MOCK_TX]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(prisma.walletTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { walletId: WALLET_ID }, skip: 0, take: 20 }),
      );
    });

    it('calculates correct skip for page 2', async () => {
      await service.listTransactions(USER_ID, 2, 10);
      expect(prisma.walletTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  // ── credit (standalone — optimistic locking) ──────────────────────────────

  describe('credit (standalone)', () => {
    it('updates balance and creates transaction record', async () => {
      await service.credit(USER_ID, 5_000, 'ref-credit-1', TxType.CONTRIBUTION);

      expect(prisma._txClient.wallet.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: WALLET_ID, version: 0 },
          data: expect.objectContaining({ balance: { increment: 5_000 }, version: { increment: 1 } }),
        }),
      );
      expect(prisma._txClient.walletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            walletId: WALLET_ID,
            amount: 5_000,
            type: TxType.CONTRIBUTION,
            direction: TxDirection.CREDIT,
            reference: 'ref-credit-1',
          }),
        }),
      );
    });

    it('retries once on version conflict then succeeds', async () => {
      // First call: version conflict; second call: success
      prisma._txClient.wallet.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });

      await service.credit(USER_ID, 5_000, 'ref-retry', TxType.CONTRIBUTION);

      expect(prisma._txClient.wallet.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.wallet.findUniqueOrThrow).toHaveBeenCalledTimes(2);
    });

    it('throws ConflictException after max retries are exhausted', async () => {
      prisma._txClient.wallet.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.credit(USER_ID, 5_000, 'ref-conflict', TxType.CONTRIBUTION),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── debit (standalone — optimistic locking) ───────────────────────────────

  describe('debit (standalone)', () => {
    it('decrements balance and creates DEBIT transaction record', async () => {
      await service.debit(USER_ID, 3_000, 'ref-debit-1', TxType.WITHDRAWAL);

      expect(prisma._txClient.wallet.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ balance: { decrement: 3_000 } }),
        }),
      );
      expect(prisma._txClient.walletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ direction: TxDirection.DEBIT }),
        }),
      );
    });

    it('throws 422 when balance is insufficient', async () => {
      prisma.wallet.findUniqueOrThrow.mockResolvedValue({ ...MOCK_WALLET, balance: 1_000 });

      await expect(
        service.debit(USER_ID, 5_000, 'ref-broke', TxType.WITHDRAWAL),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('includes available and requested amounts in the 422 message', async () => {
      prisma.wallet.findUniqueOrThrow.mockResolvedValue({ ...MOCK_WALLET, balance: 500 });

      try {
        await service.debit(USER_ID, 2_000, 'ref-msg', TxType.WITHDRAWAL);
        fail('expected exception');
      } catch (err) {
        expect((err as UnprocessableEntityException).message).toContain('500.00');
        expect((err as UnprocessableEntityException).message).toContain('2000.00');
      }
    });
  });

  // ── credit / debit with external transaction ──────────────────────────────

  describe('credit with external tx', () => {
    it('uses provided tx client without starting its own transaction', async () => {
      const externalTx = {
        wallet: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(MOCK_WALLET),
          update: jest.fn().mockResolvedValue(MOCK_WALLET),
        },
        walletTransaction: {
          create: jest.fn().mockResolvedValue(MOCK_TX),
        },
      } as unknown as import('@prisma/client').Prisma.TransactionClient;

      await service.credit(USER_ID, 5_000, 'ref-ext', TxType.PAYOUT, externalTx);

      expect(prisma.$.$transaction).not.toHaveBeenCalled();
      expect((externalTx.wallet as unknown as { update: jest.Mock }).update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ balance: { increment: 5_000 } }),
        }),
      );
    });

    it('throws 422 within external tx when balance is insufficient for debit', async () => {
      const externalTx = {
        wallet: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ ...MOCK_WALLET, balance: 100 }),
          update: jest.fn(),
        },
        walletTransaction: { create: jest.fn() },
      } as unknown as import('@prisma/client').Prisma.TransactionClient;

      await expect(
        service.debit(USER_ID, 5_000, 'ref-ext-broke', TxType.WITHDRAWAL, externalTx),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
