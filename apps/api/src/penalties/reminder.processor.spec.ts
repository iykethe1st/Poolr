import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContribStatus } from '@prisma/client';
import { ReminderProcessor } from './reminder.processor';
import { PrismaService } from '../database/prisma.service';
import { ReminderJobData } from './reminder-job';
import { NOTIFICATION_EVENTS } from '../notifications/events/notification.events';

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
      findUnique: jest.fn().mockResolvedValue({
        id: CONTRIB_ID,
        amount: 5000,
        status: ContribStatus.PENDING,
      }),
    },
    groupMember: {
      findUnique: jest.fn().mockResolvedValue({ id: MEMBER_ID, userId: USER_ID }),
    },
  };
}

describe('ReminderProcessor', () => {
  let processor: ReminderProcessor;
  let prisma: ReturnType<typeof makePrismaMock>;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    processor = module.get(ReminderProcessor);
  });

  afterEach(() => jest.clearAllMocks());

  it('emits CONTRIBUTION_REMINDER event for PENDING contribution (48h)', async () => {
    await processor.process(makeJob(48));

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      NOTIFICATION_EVENTS.CONTRIBUTION_REMINDER,
      expect.objectContaining({
        userId: USER_ID,
        hoursRemaining: 48,
        groupName: 'Test Pool',
      }),
    );
  });

  it('emits reminder event with hoursRemaining=0 for due-day reminder', async () => {
    await processor.process(makeJob(0));

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      NOTIFICATION_EVENTS.CONTRIBUTION_REMINDER,
      expect.objectContaining({ hoursRemaining: 0 }),
    );
  });

  it('skips event when contribution is already PAID', async () => {
    prisma.contribution.findUnique.mockResolvedValue({
      id: CONTRIB_ID,
      amount: 5000,
      status: ContribStatus.PAID,
    });

    await processor.process(makeJob(24));

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('skips event when contribution record is not found', async () => {
    prisma.contribution.findUnique.mockResolvedValue(null);

    await processor.process(makeJob(24));

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('returns without error when GroupMember record is missing', async () => {
    prisma.groupMember.findUnique.mockResolvedValue(null);

    await expect(processor.process(makeJob(24))).resolves.not.toThrow();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
