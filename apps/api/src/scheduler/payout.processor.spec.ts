import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import {
  ContribStatus,
  CycleStatus,
  NotifChannel,
  PayoutStatus,
  PenaltyReason,
  PenaltyStatus,
} from '@prisma/client';
import { PayoutProcessor } from './payout.processor';
import { PrismaService } from '../database/prisma.service';
import { PaystackService } from '../payments/paystack.service';
import { PAYOUT_EVENTS, PayoutJobData } from './events/payout.events';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CYCLE_ID = 'cycle-1';
const RECIPIENT_ID = 'user-2';
const GROUP_ID = 'group-1';
const MEMBER_ID = 'member-1';
const MEMBER_USER_ID = 'user-1';

const PAID_CONTRIBUTION = {
  id: 'contrib-1',
  cycleId: CYCLE_ID,
  memberId: MEMBER_ID,
  amount: 5000,
  status: ContribStatus.PAID,
  paystackRef: 'ref_1',
  paidAt: new Date(),
  dueAt: new Date(),
  member: { id: MEMBER_ID, userId: MEMBER_USER_ID },
};

const UNPAID_CONTRIBUTION = {
  id: 'contrib-2',
  cycleId: CYCLE_ID,
  memberId: 'member-2',
  amount: 5000,
  status: ContribStatus.PENDING,
  paystackRef: null,
  paidAt: null,
  dueAt: new Date(),
  member: { id: 'member-2', userId: 'user-3' },
};

const MOCK_CYCLE = {
  id: CYCLE_ID,
  groupId: GROUP_ID,
  recipientId: RECIPIENT_ID,
  cycleNumber: 1,
  dueDate: new Date(),
  status: CycleStatus.PENDING,
  group: { id: GROUP_ID, name: 'Test Pool', adminId: 'admin-1' },
  contributions: [PAID_CONTRIBUTION],
};

function makeJob(
  data: PayoutJobData,
  opts?: { attempts?: number; attemptsMade?: number },
): Job<PayoutJobData> {
  return {
    id: '1',
    name: 'disburse',
    data,
    opts: { attempts: opts?.attempts ?? 3 },
    attemptsMade: opts?.attemptsMade ?? 0,
  } as unknown as Job<PayoutJobData>;
}

function makePrismaMock() {
  const txClient = {
    payout: { update: jest.fn().mockResolvedValue({}) },
    cycle: { update: jest.fn().mockResolvedValue({}) },
    contribution: { update: jest.fn().mockResolvedValue({}) },
    penalty: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    cycle: { findUnique: jest.fn().mockResolvedValue(MOCK_CYCLE) },
    payout: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'payout-1', status: PayoutStatus.PENDING }),
      update: jest.fn().mockResolvedValue({}),
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

describe('PayoutProcessor', () => {
  let processor: PayoutProcessor;
  let prisma: ReturnType<typeof makePrismaMock>;
  let paystack: { initiateTransfer: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  const JOB_DATA: PayoutJobData = { cycleId: CYCLE_ID, recipientId: RECIPIENT_ID, groupId: GROUP_ID };

  beforeEach(async () => {
    prisma = makePrismaMock();
    paystack = { initiateTransfer: jest.fn().mockResolvedValue({ transferCode: 'TRF_test_123', reference: 'payout_ref' }) };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: PaystackService, useValue: paystack },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(5) } },
      ],
    }).compile();

    processor = module.get(PayoutProcessor);
  });

  afterEach(() => jest.clearAllMocks());

  // ── process ───────────────────────────────────────────────────────────────

  describe('process', () => {
    it('initiates payout for cycle with all contributions paid', async () => {
      const result = await processor.process(makeJob(JOB_DATA));

      expect(paystack.initiateTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ amountNgn: 5000, reference: expect.stringContaining('sched_') }),
      );
      expect(prisma.payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ recipientId: RECIPIENT_ID, amount: 5000 }),
        }),
      );
      expect(prisma._txClient.payout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paystackTransferCode: 'TRF_test_123', status: PayoutStatus.INITIATED }),
        }),
      );
      expect(prisma._txClient.cycle.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: CycleStatus.ACTIVE } }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PAYOUT_EVENTS.INITIATED,
        expect.objectContaining({ transferCode: 'TRF_test_123', amountNgn: 5000 }),
      );
      expect(result).toMatchObject({ transferCode: 'TRF_test_123', amountNgn: 5000 });
    });

    it('applies penalties to unpaid contributions and disburses partial amount', async () => {
      prisma.cycle.findUnique.mockResolvedValue({
        ...MOCK_CYCLE,
        contributions: [PAID_CONTRIBUTION, UNPAID_CONTRIBUTION],
      });

      const result = await processor.process(makeJob(JOB_DATA));

      // Penalties applied only to unpaid
      expect(prisma._txClient.contribution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: UNPAID_CONTRIBUTION.id },
          data: { status: ContribStatus.OVERDUE },
        }),
      );
      expect(prisma._txClient.penalty.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: PenaltyReason.LATE_PAYMENT,
            status: PenaltyStatus.PENDING,
          }),
        }),
      );
      // Only paid contribution amount is disbursed
      expect(paystack.initiateTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ amountNgn: 5000 }),
      );
      expect(result).toMatchObject({ amountNgn: 5000 });
    });

    it('skips payout if no contributions are paid', async () => {
      prisma.cycle.findUnique.mockResolvedValue({
        ...MOCK_CYCLE,
        contributions: [UNPAID_CONTRIBUTION],
      });

      const result = await processor.process(makeJob(JOB_DATA));

      expect(paystack.initiateTransfer).not.toHaveBeenCalled();
      expect(result).toMatchObject({ skipped: true, reason: 'no contributions paid' });
    });

    it('is idempotent — skips if payout already INITIATED', async () => {
      prisma.payout.findFirst.mockResolvedValue({
        id: 'payout-1',
        status: PayoutStatus.INITIATED,
      });

      const result = await processor.process(makeJob(JOB_DATA));

      expect(paystack.initiateTransfer).not.toHaveBeenCalled();
      expect(result).toMatchObject({ skipped: true });
    });

    it('is idempotent — skips if payout already COMPLETED', async () => {
      prisma.payout.findFirst.mockResolvedValue({
        id: 'payout-1',
        status: PayoutStatus.COMPLETED,
      });

      const result = await processor.process(makeJob(JOB_DATA));

      expect(paystack.initiateTransfer).not.toHaveBeenCalled();
      expect(result).toMatchObject({ skipped: true });
    });

    it('throws and lets BullMQ retry if Paystack transfer fails', async () => {
      paystack.initiateTransfer.mockRejectedValue(new Error('Paystack timeout'));

      await expect(processor.process(makeJob(JOB_DATA))).rejects.toThrow('Paystack timeout');
    });

    it('throws if cycle not found', async () => {
      prisma.cycle.findUnique.mockResolvedValue(null);

      await expect(processor.process(makeJob(JOB_DATA))).rejects.toThrow(`Cycle ${CYCLE_ID} not found`);
    });
  });

  // ── onFailed ──────────────────────────────────────────────────────────────

  describe('onFailed', () => {
    const error = new Error('Paystack unavailable');

    it('emits dead-letter event and creates admin notification on final failure', async () => {
      prisma.cycle.findUnique.mockResolvedValue({
        ...MOCK_CYCLE,
        group: { ...MOCK_CYCLE.group, adminId: 'admin-1' },
      });

      const job = makeJob(JOB_DATA, { attempts: 3, attemptsMade: 3 });
      await processor.onFailed(job, error);

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'admin-1',
            channel: NotifChannel.IN_APP,
            title: 'Payout Failed',
          }),
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PAYOUT_EVENTS.DEAD_LETTERED,
        expect.objectContaining({ cycleId: CYCLE_ID, error: error.message }),
      );
    });

    it('does NOT emit dead-letter event on intermediate failure (will be retried)', async () => {
      const job = makeJob(JOB_DATA, { attempts: 3, attemptsMade: 1 });
      await processor.onFailed(job, error);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('handles undefined job gracefully', async () => {
      await expect(processor.onFailed(undefined, error)).resolves.not.toThrow();
    });
  });
});
