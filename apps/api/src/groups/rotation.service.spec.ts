import { Test, TestingModule } from '@nestjs/testing';
import { Frequency, GroupStatus, MemberStatus } from '@prisma/client';
import { RotationService } from './rotation.service';
import { PrismaService } from '../database/prisma.service';

let cycleIdCounter = 0;

function makePrismaMock() {
  const txClient = {
    cycle: {
      create: jest.fn().mockImplementation(({ data }: { data: { dueDate: Date } }) => {
        cycleIdCounter += 1;
        return Promise.resolve({ id: `cycle-${cycleIdCounter}`, dueDate: data.dueDate });
      }),
    },
    contribution: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    $: {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof txClient) => unknown) => fn(txClient)),
    },
    _txClient: txClient,
  };
}

const BASE_GROUP = {
  id: 'group-1',
  frequency: Frequency.MONTHLY,
  startDate: new Date('2026-08-01'),
  status: GroupStatus.ACTIVE,
  contributionAmount: 10_000,
};

const makeMembers = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `member-${i + 1}`,
    userId: `user-${i + 1}`,
    rotationPosition: i + 1,
    memberStatus: MemberStatus.ACTIVE,
  }));

describe('RotationService', () => {
  let service: RotationService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    cycleIdCounter = 0;
    prisma = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RotationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(RotationService);
  });

  afterEach(() => jest.clearAllMocks());

  it('creates one cycle per member', async () => {
    await service.generateCycles(BASE_GROUP, makeMembers(3));
    expect(prisma._txClient.cycle.create).toHaveBeenCalledTimes(3);
  });

  it('sets first cycle to ACTIVE and the rest to PENDING', async () => {
    await service.generateCycles(BASE_GROUP, makeMembers(3));
    const calls = prisma._txClient.cycle.create.mock.calls as Array<[{ data: Record<string, unknown> }]>;
    expect(calls[0][0].data['status']).toBe('ACTIVE');
    expect(calls[1][0].data['status']).toBe('PENDING');
    expect(calls[2][0].data['status']).toBe('PENDING');
  });

  it('pre-creates one contribution per member for the first cycle only', async () => {
    await service.generateCycles(BASE_GROUP, makeMembers(3));
    // 3 members → 3 contributions for cycle 1, nothing for cycles 2 and 3
    expect(prisma._txClient.contribution.create).toHaveBeenCalledTimes(3);
    const calls = prisma._txClient.contribution.create.mock.calls as Array<[{ data: Record<string, unknown> }]>;
    expect(calls[0][0].data['cycleId']).toBe('cycle-1');
    expect(calls[1][0].data['cycleId']).toBe('cycle-1');
    expect(calls[2][0].data['cycleId']).toBe('cycle-1');
  });

  it('pre-creates contributions with correct amount and PENDING status', async () => {
    await service.generateCycles(BASE_GROUP, makeMembers(2));
    const calls = prisma._txClient.contribution.create.mock.calls as Array<[{ data: Record<string, unknown> }]>;
    expect(calls[0][0].data['amount']).toBe(10_000);
    expect(calls[0][0].data['status']).toBe('PENDING');
  });

  it('assigns correct cycle numbers and recipients in rotation order', async () => {
    await service.generateCycles(BASE_GROUP, makeMembers(3));
    const calls = prisma._txClient.cycle.create.mock.calls as Array<[{ data: Record<string, unknown> }]>;
    expect(calls[0][0].data).toMatchObject({ cycleNumber: 1, recipientId: 'user-1' });
    expect(calls[1][0].data).toMatchObject({ cycleNumber: 2, recipientId: 'user-2' });
    expect(calls[2][0].data).toMatchObject({ cycleNumber: 3, recipientId: 'user-3' });
  });

  it('sorts members by rotationPosition before generating cycles', async () => {
    const reversed = makeMembers(3).reverse();
    await service.generateCycles(BASE_GROUP, reversed);
    const calls = prisma._txClient.cycle.create.mock.calls as Array<[{ data: Record<string, unknown> }]>;
    expect(calls[0][0].data).toMatchObject({ cycleNumber: 1, recipientId: 'user-1' });
  });

  it('WEEKLY: due dates are 7 days apart', async () => {
    const group = { ...BASE_GROUP, frequency: Frequency.WEEKLY };
    await service.generateCycles(group, makeMembers(3));
    const calls = prisma._txClient.cycle.create.mock.calls as Array<[{ data: Record<string, unknown> }]>;
    const d0 = (calls[0][0].data['dueDate'] as Date).getTime();
    const d1 = (calls[1][0].data['dueDate'] as Date).getTime();
    const d2 = (calls[2][0].data['dueDate'] as Date).getTime();
    expect(d1 - d0).toBe(7 * 24 * 60 * 60 * 1000);
    expect(d2 - d0).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it('BIWEEKLY: due dates are 14 days apart', async () => {
    const group = { ...BASE_GROUP, frequency: Frequency.BIWEEKLY };
    await service.generateCycles(group, makeMembers(3));
    const calls = prisma._txClient.cycle.create.mock.calls as Array<[{ data: Record<string, unknown> }]>;
    const d0 = (calls[0][0].data['dueDate'] as Date).getTime();
    const d1 = (calls[1][0].data['dueDate'] as Date).getTime();
    expect(d1 - d0).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it('MONTHLY: first cycle due date equals startDate', async () => {
    await service.generateCycles(BASE_GROUP, makeMembers(2));
    const calls = prisma._txClient.cycle.create.mock.calls as Array<[{ data: Record<string, unknown> }]>;
    const d0 = calls[0][0].data['dueDate'] as Date;
    expect(d0.toISOString().slice(0, 10)).toBe('2026-08-01');
  });

  it('MONTHLY: second cycle is one calendar month later', async () => {
    await service.generateCycles(BASE_GROUP, makeMembers(2));
    const calls = prisma._txClient.cycle.create.mock.calls as Array<[{ data: Record<string, unknown> }]>;
    const d1 = calls[1][0].data['dueDate'] as Date;
    expect(d1.toISOString().slice(0, 10)).toBe('2026-09-01');
  });
});
