import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { ContribStatus, NotifChannel } from '@prisma/client';
import { ReminderProcessor } from './reminder.processor';
import { PrismaService } from '../database/prisma.service';
import { ReminderJobData } from './reminder-job';

const CONTRIB_ID = 'contrib-1';
const MEMBER_ID = 'member-1';
const USER_ID = 'user-1';
const CYCLE_ID = 'cycle-1';
const DUE_DATE = '2026-07-01T09:00:00.000Z';

function makeJob(hoursRemaining: 48 | 24 | 0): Job<ReminderJobData> {
  return {
    data: {
      contributionId: CONTRIB_ID,
      memberId: MEMBER_ID,
      cycleId: CYCLE_ID,
      groupName: 'Test Pool',
      dueDate: DUE_DATE,
      hoursRemaining,
    },
  } as unknown as Job<ReminderJobData>;
}

function makePrismaMock() {
  return {
    contribution: {
      findUnique: jest.fn().mockResolvedValue({ id: CONTRIB_ID, status: ContribStatus.PENDING }),
    },
    groupMember: {
      findUnique: jest.fn().mockResolvedValue({ id: MEMBER_ID, userId: USER_ID }),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };
}

describe('ReminderProcessor', () => {
  let processor: ReminderProcessor;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderProcessor,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    processor = module.get(ReminderProcessor);
  });

  afterEach(() => jest.clearAllMocks());

  it('creates IN_APP notification for PENDING contribution (48h reminder)', async () => {
    await processor.process(makeJob(48));

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          channel: NotifChannel.IN_APP,
          title: 'Contribution Reminder',
        }),
      }),
    );
  });

  it('uses "due today" title and urgent copy for 0h reminder', async () => {
    await processor.process(makeJob(0));

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Contribution Due Today!',
          body: expect.stringContaining('due today'),
        }),
      }),
    );
  });

  it('skips notification when contribution is already PAID', async () => {
    prisma.contribution.findUnique.mockResolvedValue({
      id: CONTRIB_ID,
      status: ContribStatus.PAID,
    });

    await processor.process(makeJob(24));

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('skips notification when contribution record is not found', async () => {
    prisma.contribution.findUnique.mockResolvedValue(null);

    await processor.process(makeJob(24));

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('returns without error when GroupMember record is missing', async () => {
    prisma.groupMember.findUnique.mockResolvedValue(null);

    await expect(processor.process(makeJob(24))).resolves.not.toThrow();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
