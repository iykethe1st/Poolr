import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ContribStatus, MemberStatus, PayoutStatus, TxDirection, TxType } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PaystackService } from './paystack.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-1';
const CYCLE_ID = 'cycle-1';
const MEMBER_ID = 'member-1';
const CONTRIBUTION_ID = 'contrib-1';
const PAYOUT_ID = 'payout-1';
const REFERENCE = 'contrib_abc_xyz_1234567890';
const TRANSFER_CODE = 'TRF_test_123';

const MOCK_GROUP = { id: 'group-1', name: 'Test Pool', contributionAmount: 5000 };
const MOCK_CYCLE = { id: CYCLE_ID, groupId: 'group-1', recipientId: 'user-2', cycleNumber: 1, dueDate: new Date(), group: MOCK_GROUP };
const MOCK_MEMBER = { id: MEMBER_ID, groupId: 'group-1', userId: USER_ID, rotationPosition: 1, memberStatus: MemberStatus.ACTIVE };
const MOCK_USER = { id: USER_ID, email: 'user@example.com' };
const MOCK_WALLET = { id: 'wallet-1', userId: USER_ID, balance: 0 };

const MOCK_CONTRIBUTION = {
  id: CONTRIBUTION_ID,
  cycleId: CYCLE_ID,
  memberId: MEMBER_ID,
  amount: 5000,
  status: ContribStatus.PENDING,
  paystackRef: REFERENCE,
  dueAt: new Date(),
  paidAt: null,
  member: MOCK_MEMBER,
  cycle: MOCK_CYCLE,
};

const MOCK_PAYOUT = {
  id: PAYOUT_ID,
  cycleId: CYCLE_ID,
  recipientId: 'user-2',
  amount: 25000,
  status: PayoutStatus.INITIATED,
  paystackTransferCode: TRANSFER_CODE,
  initiatedAt: new Date(),
  completedAt: null,
};

function makePrismaMock() {
  const txClient = {
    contribution: { update: jest.fn().mockResolvedValue({}) },
    wallet: { findUniqueOrThrow: jest.fn().mockResolvedValue(MOCK_WALLET), update: jest.fn().mockResolvedValue({}) },
    walletTransaction: { create: jest.fn().mockResolvedValue({}) },
    payout: { update: jest.fn().mockResolvedValue({}) },
  };
  return {
    cycle: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue(MOCK_CYCLE) },
    groupMember: {
      findUnique: jest.fn().mockResolvedValue(MOCK_MEMBER),
      findMany: jest.fn().mockResolvedValue([MOCK_MEMBER]),
    },
    contribution: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(MOCK_CONTRIBUTION),
      update: jest.fn().mockResolvedValue(MOCK_CONTRIBUTION),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 25000 } }),
    },
    payout: {
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue(MOCK_PAYOUT),
      update: jest.fn().mockResolvedValue(MOCK_PAYOUT),
    },
    user: { findUniqueOrThrow: jest.fn().mockResolvedValue(MOCK_USER) },
    $: {
      $transaction: jest.fn().mockImplementation(
        (fn: (tx: typeof txClient) => unknown) => fn(txClient),
      ),
    },
    _txClient: txClient,
  };
}

function makeRedisMock() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };
}

function makePaystackMock() {
  return {
    initializeTransaction: jest.fn().mockResolvedValue({
      authorizationUrl: 'https://checkout.paystack.com/test',
      reference: REFERENCE,
    }),
    verifyTransaction: jest.fn().mockResolvedValue({ status: 'success', amountKobo: 500000, reference: REFERENCE }),
    initiateTransfer: jest.fn().mockResolvedValue({ transferCode: TRANSFER_CODE, reference: 'payout_ref' }),
  };
}

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let paystack: ReturnType<typeof makePaystackMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    redis = makeRedisMock();
    paystack = makePaystackMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: PaystackService, useValue: paystack },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── initializeContribution ────────────────────────────────────────────────

  describe('initializeContribution', () => {
    it('creates contribution record and returns Paystack URL', async () => {
      prisma.cycle.findUnique.mockResolvedValue(MOCK_CYCLE);
      prisma.contribution.findUnique.mockResolvedValue(null);

      const result = await service.initializeContribution(USER_ID, CYCLE_ID);

      expect(prisma.contribution.create).toHaveBeenCalled();
      expect(paystack.initializeTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ email: MOCK_USER.email, amountNgn: 5000 }),
      );
      expect(result).toHaveProperty('authorizationUrl');
      expect(result).toHaveProperty('reference');
    });

    it('reuses existing paystackRef for pending contribution', async () => {
      prisma.cycle.findUnique.mockResolvedValue(MOCK_CYCLE);
      prisma.contribution.findUnique.mockResolvedValue(MOCK_CONTRIBUTION);

      const result = await service.initializeContribution(USER_ID, CYCLE_ID);

      expect(prisma.contribution.create).not.toHaveBeenCalled();
      expect(result.reference).toBe(REFERENCE);
    });

    it('throws NotFoundException for unknown cycle', async () => {
      prisma.cycle.findUnique.mockResolvedValue(null);
      await expect(service.initializeContribution(USER_ID, CYCLE_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException if not an active member', async () => {
      prisma.cycle.findUnique.mockResolvedValue(MOCK_CYCLE);
      prisma.groupMember.findUnique.mockResolvedValue(null);
      await expect(service.initializeContribution(USER_ID, CYCLE_ID)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException if contribution already paid', async () => {
      prisma.cycle.findUnique.mockResolvedValue(MOCK_CYCLE);
      prisma.contribution.findUnique.mockResolvedValue({
        ...MOCK_CONTRIBUTION,
        status: ContribStatus.PAID,
      });
      await expect(service.initializeContribution(USER_ID, CYCLE_ID)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── handleChargeSuccess ───────────────────────────────────────────────────

  describe('handleChargeSuccess', () => {
    const chargeData = { reference: REFERENCE, amount: 500000 };

    it('marks contribution PAID and credits wallet', async () => {
      prisma.contribution.findFirst.mockResolvedValue(MOCK_CONTRIBUTION);
      prisma.contribution.count.mockResolvedValue(1); // more unpaid remain

      await service.handleChargeSuccess(chargeData);

      expect(prisma._txClient.contribution.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: ContribStatus.PAID }) }),
      );
      expect(prisma._txClient.walletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: TxType.CONTRIBUTION, direction: TxDirection.CREDIT }),
        }),
      );
      expect(redis.set).toHaveBeenCalledWith(`webhook:charge:${REFERENCE}`, '1', expect.any(Number));
    });

    it('triggers payout when all contributions for cycle are paid', async () => {
      prisma.contribution.findFirst.mockResolvedValue(MOCK_CONTRIBUTION);
      prisma.contribution.count.mockResolvedValue(0); // all paid

      await service.handleChargeSuccess(chargeData);

      expect(paystack.initiateTransfer).toHaveBeenCalled();
      expect(prisma.payout.create).toHaveBeenCalled();
    });

    it('is idempotent — skips if already processed', async () => {
      redis.get.mockResolvedValue('1');

      await service.handleChargeSuccess(chargeData);

      expect(prisma.contribution.findFirst).not.toHaveBeenCalled();
    });

    it('is idempotent — skips if contribution already PAID', async () => {
      prisma.contribution.findFirst.mockResolvedValue({
        ...MOCK_CONTRIBUTION,
        status: ContribStatus.PAID,
      });

      await service.handleChargeSuccess(chargeData);

      expect(prisma.$.$transaction).not.toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(`webhook:charge:${REFERENCE}`, '1', expect.any(Number));
    });
  });

  // ── handleTransferSuccess ─────────────────────────────────────────────────

  describe('handleTransferSuccess', () => {
    const transferData = { transfer_code: TRANSFER_CODE, amount: 2500000 };

    it('marks payout COMPLETED and credits recipient wallet', async () => {
      prisma.payout.findFirst.mockResolvedValue(MOCK_PAYOUT);

      await service.handleTransferSuccess(transferData);

      expect(prisma._txClient.payout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PayoutStatus.COMPLETED }),
        }),
      );
      expect(prisma._txClient.walletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: TxType.PAYOUT, direction: TxDirection.CREDIT }),
        }),
      );
      expect(redis.set).toHaveBeenCalledWith(`webhook:transfer:${TRANSFER_CODE}`, '1', expect.any(Number));
    });

    it('is idempotent — skips if already processed', async () => {
      redis.get.mockResolvedValue('1');

      await service.handleTransferSuccess(transferData);

      expect(prisma.payout.findFirst).not.toHaveBeenCalled();
    });

    it('is idempotent — skips if payout already COMPLETED', async () => {
      prisma.payout.findFirst.mockResolvedValue({
        ...MOCK_PAYOUT,
        status: PayoutStatus.COMPLETED,
      });

      await service.handleTransferSuccess(transferData);

      expect(prisma.$.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── handleTransferFailed ──────────────────────────────────────────────────

  describe('handleTransferFailed', () => {
    const failedData = { transfer_code: TRANSFER_CODE };

    it('marks payout FAILED', async () => {
      prisma.payout.findFirst.mockResolvedValue(MOCK_PAYOUT);

      await service.handleTransferFailed(failedData);

      expect(prisma.payout.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: PayoutStatus.FAILED } }),
      );
    });

    it('is idempotent — skips if already processed', async () => {
      redis.get.mockResolvedValue('1');

      await service.handleTransferFailed(failedData);

      expect(prisma.payout.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── handleWebhook routing ─────────────────────────────────────────────────

  describe('handleWebhook', () => {
    it('routes charge.success to handleChargeSuccess', async () => {
      const spy = jest.spyOn(service, 'handleChargeSuccess').mockResolvedValue();
      await service.handleWebhook('charge.success', { reference: 'ref' });
      expect(spy).toHaveBeenCalled();
    });

    it('routes transfer.success to handleTransferSuccess', async () => {
      const spy = jest.spyOn(service, 'handleTransferSuccess').mockResolvedValue();
      await service.handleWebhook('transfer.success', { transfer_code: 'TRF' });
      expect(spy).toHaveBeenCalled();
    });

    it('routes transfer.failed to handleTransferFailed', async () => {
      const spy = jest.spyOn(service, 'handleTransferFailed').mockResolvedValue();
      await service.handleWebhook('transfer.failed', { transfer_code: 'TRF' });
      expect(spy).toHaveBeenCalled();
    });
  });

  // ── listContributions / listPayouts ───────────────────────────────────────

  describe('listContributions', () => {
    it('returns contributions for the user', async () => {
      prisma.contribution.findMany.mockResolvedValue([MOCK_CONTRIBUTION]);
      const result = await service.listContributions(USER_ID);
      expect(result).toHaveLength(1);
    });
  });

  describe('listPayouts', () => {
    it('returns payouts for the user', async () => {
      prisma.payout.findFirst.mockResolvedValue(MOCK_PAYOUT);
      // findMany is what's actually called
      const findManyMock = jest.fn().mockResolvedValue([MOCK_PAYOUT]);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (prisma.payout as unknown as Record<string, jest.Mock>)['findMany'] = findManyMock;
      const result = await service.listPayouts('user-2');
      expect(result).toHaveLength(1);
    });
  });
});
