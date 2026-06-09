import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ContribStatus,
  NotifChannel,
  PenaltyReason,
  PenaltyStatus,
} from '@prisma/client';
import { PenaltiesService } from './penalties.service';
import { PrismaService } from '../database/prisma.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GROUP_ID = 'group-1';
const ADMIN_ID = 'admin-1';
const MEMBER_ID = 'member-1';
const MEMBER_USER_ID = 'user-1';
const CONTRIB_ID = 'contrib-1';
const CYCLE_ID = 'cycle-1';
const PENALTY_ID = 'penalty-1';

const MOCK_GROUP = {
  id: GROUP_ID,
  adminId: ADMIN_ID,
  name: 'Test Pool',
  penaltyConfig: null,
};

const MOCK_CONTRIBUTION = {
  id: CONTRIB_ID,
  cycleId: CYCLE_ID,
  memberId: MEMBER_ID,
  amount: 10_000,
  status: ContribStatus.PENDING,
  dueAt: new Date('2026-06-01T00:00:00Z'),
  paidAt: null,
  paystackRef: null,
  member: { id: MEMBER_ID, userId: MEMBER_USER_ID, groupId: GROUP_ID },
  cycle: {
    id: CYCLE_ID,
    group: MOCK_GROUP,
  },
};

const MOCK_PENALTY = {
  id: PENALTY_ID,
  contributionId: CONTRIB_ID,
  memberId: MEMBER_ID,
  penaltyAmount: 500,
  reason: PenaltyReason.MISSED_PAYMENT,
  status: PenaltyStatus.APPLIED,
  appliedAt: new Date(),
  createdAt: new Date(),
  contribution: {
    ...MOCK_CONTRIBUTION,
    cycle: { ...MOCK_CONTRIBUTION.cycle },
  },
};

function makePrismaMock() {
  const txClient = {
    contribution: { update: jest.fn().mockResolvedValue({}) },
    penalty: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    contribution: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(MOCK_CONTRIBUTION),
    },
    penalty: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    groupMember: {
      findMany: jest.fn().mockResolvedValue([{ id: MEMBER_ID }]),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
    $: {
      $transaction: jest.fn().mockImplementation(
        (fn: (tx: typeof txClient) => unknown) => fn(txClient),
      ),
    },
    _txClient: txClient,
  };
}

describe('PenaltiesService', () => {
  let service: PenaltiesService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PenaltiesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PenaltiesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── applyPenalty ──────────────────────────────────────────────────────────

  describe('applyPenalty', () => {
    it('marks contribution OVERDUE and creates penalty using default (5%) config', async () => {
      await service.applyPenalty(MOCK_CONTRIBUTION as never);

      expect(prisma._txClient.contribution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CONTRIB_ID },
          data: { status: ContribStatus.OVERDUE },
        }),
      );
      expect(prisma._txClient.penalty.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contributionId: CONTRIB_ID,
            memberId: MEMBER_ID,
            penaltyAmount: 500, // 5% of 10_000
            reason: PenaltyReason.MISSED_PAYMENT,
            status: PenaltyStatus.APPLIED,
          }),
        }),
      );
    });

    it('applies flat-fee penalty when group penaltyConfig specifies type flat', async () => {
      const flatConfig = { type: 'flat' as const, amount: 1_000, gracePeriodHours: 0 };
      const contrib = {
        ...MOCK_CONTRIBUTION,
        cycle: { ...MOCK_CONTRIBUTION.cycle, group: { ...MOCK_GROUP, penaltyConfig: flatConfig } },
      };

      await service.applyPenalty(contrib as never);

      expect(prisma._txClient.penalty.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ penaltyAmount: 1_000 }),
        }),
      );
    });

    it('applies percentage penalty when group penaltyConfig specifies type percentage', async () => {
      const pctConfig = { type: 'percentage' as const, amount: 10, gracePeriodHours: 0 };
      const contrib = {
        ...MOCK_CONTRIBUTION,
        cycle: { ...MOCK_CONTRIBUTION.cycle, group: { ...MOCK_GROUP, penaltyConfig: pctConfig } },
      };

      await service.applyPenalty(contrib as never);

      expect(prisma._txClient.penalty.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ penaltyAmount: 1_000 }), // 10% of 10_000
        }),
      );
    });

    it('is idempotent — does nothing if a penalty already exists for this contribution', async () => {
      prisma.penalty.findFirst.mockResolvedValue(MOCK_PENALTY);

      await service.applyPenalty(MOCK_CONTRIBUTION as never);

      expect(prisma._txClient.contribution.update).not.toHaveBeenCalled();
      expect(prisma._txClient.penalty.create).not.toHaveBeenCalled();
    });

    it('sends an IN_APP notification to the member after applying penalty', async () => {
      await service.applyPenalty(MOCK_CONTRIBUTION as never);

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: MEMBER_USER_ID,
            channel: NotifChannel.IN_APP,
            title: 'Penalty Applied',
          }),
        }),
      );
    });
  });

  // ── applyMissedPenalties cron ─────────────────────────────────────────────

  describe('applyMissedPenalties', () => {
    it('applies penalties to contributions past due date and grace period', async () => {
      const overdueContrib = {
        ...MOCK_CONTRIBUTION,
        dueAt: new Date(Date.now() - 48 * 3_600_000), // 48h ago
        cycle: {
          ...MOCK_CONTRIBUTION.cycle,
          group: { ...MOCK_GROUP, penaltyConfig: { type: 'flat', amount: 200, gracePeriodHours: 0 } },
        },
      };
      prisma.contribution.findMany.mockResolvedValue([overdueContrib]);

      await service.applyMissedPenalties();

      expect(prisma._txClient.penalty.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ penaltyAmount: 200 }),
        }),
      );
    });

    it('skips contributions still within the grace period', async () => {
      const justOverdueContrib = {
        ...MOCK_CONTRIBUTION,
        dueAt: new Date(Date.now() - 2 * 3_600_000), // 2h ago
        cycle: {
          ...MOCK_CONTRIBUTION.cycle,
          group: { ...MOCK_GROUP, penaltyConfig: { type: 'flat', amount: 200, gracePeriodHours: 24 } },
        },
      };
      prisma.contribution.findMany.mockResolvedValue([justOverdueContrib]);

      await service.applyMissedPenalties();

      expect(prisma._txClient.penalty.create).not.toHaveBeenCalled();
    });

    it('does nothing when no contributions are overdue', async () => {
      prisma.contribution.findMany.mockResolvedValue([]);

      await service.applyMissedPenalties();

      expect(prisma._txClient.penalty.create).not.toHaveBeenCalled();
    });
  });

  // ── listMyPenalties ───────────────────────────────────────────────────────

  describe('listMyPenalties', () => {
    it('returns penalties belonging to the user via their group memberships', async () => {
      prisma.penalty.findMany.mockResolvedValue([MOCK_PENALTY]);

      const result = await service.listMyPenalties(MEMBER_USER_ID);

      expect(prisma.groupMember.findMany).toHaveBeenCalledWith({
        where: { userId: MEMBER_USER_ID },
        select: { id: true },
      });
      expect(prisma.penalty.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { memberId: { in: [MEMBER_ID] } },
        }),
      );
      expect(result).toEqual([MOCK_PENALTY]);
    });

    it('returns empty array when user has no memberships', async () => {
      prisma.groupMember.findMany.mockResolvedValue([]);

      const result = await service.listMyPenalties(MEMBER_USER_ID);

      expect(result).toEqual([]);
    });
  });

  // ── waivePenalty ──────────────────────────────────────────────────────────

  describe('waivePenalty', () => {
    const WAIVE_DTO = { reason: 'First-time offence' };

    beforeEach(() => {
      prisma.penalty.findUnique.mockResolvedValue(MOCK_PENALTY);
    });

    it('allows group admin to waive an APPLIED penalty', async () => {
      const result = await service.waivePenalty(PENALTY_ID, ADMIN_ID, WAIVE_DTO);

      expect(prisma.penalty.update).toHaveBeenCalledWith({
        where: { id: PENALTY_ID },
        data: { status: PenaltyStatus.WAIVED },
      });
      expect(result).toEqual({ message: 'Penalty waived successfully' });
    });

    it('throws NotFoundException when penalty does not exist', async () => {
      prisma.penalty.findUnique.mockResolvedValue(null);

      await expect(service.waivePenalty(PENALTY_ID, ADMIN_ID, WAIVE_DTO)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when caller is not the group admin', async () => {
      await expect(
        service.waivePenalty(PENALTY_ID, 'not-the-admin', WAIVE_DTO),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when penalty is already waived', async () => {
      prisma.penalty.findUnique.mockResolvedValue({
        ...MOCK_PENALTY,
        status: PenaltyStatus.WAIVED,
      });

      await expect(service.waivePenalty(PENALTY_ID, ADMIN_ID, WAIVE_DTO)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
