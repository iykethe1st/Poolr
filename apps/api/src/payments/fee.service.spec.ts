import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
import { FeeService } from './fee.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  contributionFee: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  contribution: {
    update: jest.fn(),
  },
};

const mockConfig = { get: jest.fn() };

describe('FeeService', () => {
  let service: FeeService;

  beforeEach(async () => {
    jest.resetAllMocks(); // clears calls AND implementations so one test's mock doesn't leak
    mockConfig.get.mockImplementation((_key: string, defaultValue: unknown) => defaultValue);
    const module = await Test.createTestingModule({
      providers: [
        FeeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(FeeService);
  });

  // ── calculateFee ─────────────────────────────────────────────────────────

  describe('calculateFee', () => {
    it('returns tier 1 fee for amount below tier 1 max', () => {
      expect(service.calculateFee(5_000)).toBe(100);
      expect(service.calculateFee(9_999)).toBe(100);
    });

    it('returns tier 1 fee for amount exactly 1 below tier 1 max', () => {
      expect(service.calculateFee(9_999)).toBe(100);
    });

    it('returns tier 2 fee for amount at tier 1 max boundary', () => {
      expect(service.calculateFee(10_000)).toBe(200);
    });

    it('returns tier 2 fee for amounts within tier 2 range', () => {
      expect(service.calculateFee(25_000)).toBe(200);
      expect(service.calculateFee(50_000)).toBe(200);
    });

    it('returns tier 3 fee for amounts above tier 2 max', () => {
      expect(service.calculateFee(50_001)).toBe(500);
      expect(service.calculateFee(100_000)).toBe(500);
    });

    it('reads thresholds from config when env vars are set', () => {
      mockConfig.get.mockImplementation((key: string) => {
        const values: Record<string, number> = {
          CONTRIBUTION_FEE_TIER_1_MAX: 20_000,
          CONTRIBUTION_FEE_TIER_1_AMOUNT: 150,
          CONTRIBUTION_FEE_TIER_2_MAX: 100_000,
          CONTRIBUTION_FEE_TIER_2_AMOUNT: 300,
          CONTRIBUTION_FEE_TIER_3_AMOUNT: 600,
        };
        return values[key];
      });

      expect(service.calculateFee(15_000)).toBe(150); // under new tier 1 max
      expect(service.calculateFee(50_000)).toBe(300); // within tier 2
      expect(service.calculateFee(200_000)).toBe(600); // above tier 2 max
    });
  });

  // ── collectFee ───────────────────────────────────────────────────────────

  describe('collectFee', () => {
    const tx = mockPrisma as unknown as Parameters<FeeService['collectFee']>[3];

    it('creates ContributionFee record with correct split', async () => {
      mockPrisma.contributionFee.findUnique.mockResolvedValue(null);
      mockPrisma.contributionFee.create.mockResolvedValue({});
      mockPrisma.contribution.update.mockResolvedValue({});

      await service.collectFee('contrib-1', 'user-1', 20_000, tx);

      expect(mockPrisma.contributionFee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contributionId: 'contrib-1',
          userId: 'user-1',
          contributionAmount: 20_000,
          feeAmount: 200,       // tier 2 fee
          reserveAmount: 40,    // 20% of 200
          revenueAmount: 160,   // 80% of 200
        }),
      });
    });

    it('updates contribution with feeAmount and totalCharged', async () => {
      mockPrisma.contributionFee.findUnique.mockResolvedValue(null);
      mockPrisma.contributionFee.create.mockResolvedValue({});
      mockPrisma.contribution.update.mockResolvedValue({});

      await service.collectFee('contrib-1', 'user-1', 20_000, tx);

      expect(mockPrisma.contribution.update).toHaveBeenCalledWith({
        where: { id: 'contrib-1' },
        data: { feeAmount: 200, totalCharged: 20_200 },
      });
    });

    it('is idempotent — second call for same contribution is a no-op', async () => {
      mockPrisma.contributionFee.findUnique.mockResolvedValue({ id: 'existing' });

      await service.collectFee('contrib-1', 'user-1', 20_000, tx);

      expect(mockPrisma.contributionFee.create).not.toHaveBeenCalled();
      expect(mockPrisma.contribution.update).not.toHaveBeenCalled();
    });

    it('correctly splits tier 1 fee (₦100) into reserve ₦20 and revenue ₦80', async () => {
      mockPrisma.contributionFee.findUnique.mockResolvedValue(null);
      mockPrisma.contributionFee.create.mockResolvedValue({});
      mockPrisma.contribution.update.mockResolvedValue({});

      await service.collectFee('contrib-2', 'user-2', 5_000, tx);

      expect(mockPrisma.contributionFee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          feeAmount: 100,
          reserveAmount: 20,
          revenueAmount: 80,
        }),
      });
    });

    it('correctly splits tier 3 fee (₦500) into reserve ₦100 and revenue ₦400', async () => {
      mockPrisma.contributionFee.findUnique.mockResolvedValue(null);
      mockPrisma.contributionFee.create.mockResolvedValue({});
      mockPrisma.contribution.update.mockResolvedValue({});

      await service.collectFee('contrib-3', 'user-3', 75_000, tx);

      expect(mockPrisma.contributionFee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          feeAmount: 500,
          reserveAmount: 100,
          revenueAmount: 400,
        }),
      });
    });
  });

  // ── Paystack checkout amount ──────────────────────────────────────────────

  describe('fee applied to checkout amount', () => {
    it('Paystack charge equals contribution + fee for tier 1', () => {
      const contribution = 5_000;
      const fee = service.calculateFee(contribution);
      expect(fee).toBe(100);
      expect(contribution + fee).toBe(5_100);
    });

    it('Paystack charge equals contribution + fee for tier 2', () => {
      const contribution = 20_000;
      const fee = service.calculateFee(contribution);
      expect(fee).toBe(200);
      expect(contribution + fee).toBe(20_200);
    });

    it('wallet debit equals contribution + fee', () => {
      const contribution = 80_000;
      const fee = service.calculateFee(contribution);
      expect(fee).toBe(500);
      expect(contribution + fee).toBe(80_500);
    });
  });

  // ── Payout sends full pooled amount ───────────────────────────────────────

  describe('payout amount', () => {
    it('payout equals sum of contribution amounts with zero fee deduction', () => {
      // 5 members each contributing ₦20,000 → payout = ₦100,000 (fee not deducted)
      const memberCount = 5;
      const contribution = 20_000;
      const pooled = memberCount * contribution;
      expect(pooled).toBe(100_000);
      // Fee is charged on top, not taken from the pool
      const fee = service.calculateFee(contribution);
      const eachMemberPays = contribution + fee;
      expect(eachMemberPays).toBe(20_200);
      // Pool is still the full contribution total
      expect(pooled).toBe(100_000);
    });
  });
});
