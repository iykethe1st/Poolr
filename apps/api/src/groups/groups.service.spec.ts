import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GroupStatus, MemberStatus, Frequency, Currency } from '@prisma/client';
import { GroupsService } from './groups.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TermiiService } from '../auth/termii.service';
import { RotationService } from './rotation.service';

const GROUP_ID = 'group-1';
const ADMIN_ID = 'admin-1';
const MEMBER_ID = 'member-1';
const MEMBER_USER_ID = 'user-2';

const MOCK_GROUP = {
  id: GROUP_ID,
  adminId: ADMIN_ID,
  name: 'Test Pool',
  contributionAmount: 5000,
  currency: Currency.NGN,
  frequency: Frequency.MONTHLY,
  maxMembers: 5,
  status: GroupStatus.DRAFT,
  startDate: new Date('2026-08-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_MEMBER = {
  id: MEMBER_ID,
  groupId: GROUP_ID,
  userId: MEMBER_USER_ID,
  rotationPosition: 2,
  memberStatus: MemberStatus.INVITED,
  joinedAt: new Date(),
};

const MOCK_ADMIN_MEMBER = {
  id: 'admin-member-1',
  groupId: GROUP_ID,
  userId: ADMIN_ID,
  rotationPosition: 1,
  memberStatus: MemberStatus.ACTIVE,
  joinedAt: new Date(),
};

const MOCK_USER = {
  id: MEMBER_USER_ID,
  fullName: 'Emeka Nwosu',
  email: 'emeka@example.com',
  phone: '+2348099998888',
};

function makePrismaMock() {
  const txClient = {
    group: { create: jest.fn().mockResolvedValue(MOCK_GROUP) },
    groupMember: { create: jest.fn().mockResolvedValue(MOCK_ADMIN_MEMBER), update: jest.fn().mockResolvedValue({}) },
    cycle: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    group: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(MOCK_GROUP),
    },
    groupMember: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue(MOCK_MEMBER),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue(MOCK_USER),
      findUnique: jest.fn().mockResolvedValue({ fullName: 'Test Admin' }),
    },
    $: {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof txClient) => unknown) => fn(txClient)),
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

describe('GroupsService', () => {
  let service: GroupsService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let termii: { send: jest.Mock };
  let rotation: { generateCycles: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    redis = makeRedisMock();
    termii = { send: jest.fn().mockResolvedValue(undefined) };
    rotation = { generateCycles: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: TermiiService, useValue: termii },
        { provide: RotationService, useValue: rotation },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(GroupsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates group and adds admin as first active member', async () => {
      const dto = {
        name: 'Test Pool',
        contributionAmount: 5000,
        frequency: Frequency.MONTHLY,
        maxMembers: 5,
      };

      const result = await service.create(ADMIN_ID, dto);

      expect(prisma._txClient.group.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ adminId: ADMIN_ID, name: 'Test Pool' }) }),
      );
      expect(prisma._txClient.groupMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: ADMIN_ID,
            rotationPosition: 1,
            memberStatus: MemberStatus.ACTIVE,
          }),
        }),
      );
      expect(result).toMatchObject({ name: 'Test Pool' });
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('queries groups by user membership', async () => {
      prisma.group.findMany.mockResolvedValue([MOCK_GROUP]);
      const result = await service.findAll(ADMIN_ID);
      expect(prisma.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { members: { some: { userId: ADMIN_ID, memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } } } },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns group for a member', async () => {
      prisma.group.findUnique.mockResolvedValue({
        ...MOCK_GROUP,
        members: [{ ...MOCK_ADMIN_MEMBER, user: MOCK_USER }],
        cycles: [],
      });
      const result = await service.findOne(GROUP_ID, ADMIN_ID);
      expect(result.id).toBe(GROUP_ID);
    });

    it('throws NotFoundException for unknown group', async () => {
      prisma.group.findUnique.mockResolvedValue(null);
      await expect(service.findOne('unknown', ADMIN_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException if not a member', async () => {
      prisma.group.findUnique.mockResolvedValue({
        ...MOCK_GROUP,
        members: [{ ...MOCK_ADMIN_MEMBER, user: MOCK_USER }],
        cycles: [],
      });
      await expect(service.findOne(GROUP_ID, 'stranger')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('admin can update a DRAFT group', async () => {
      prisma.group.findUnique.mockResolvedValue(MOCK_GROUP);
      await service.update(GROUP_ID, ADMIN_ID, { name: 'Renamed Pool' });
      expect(prisma.group.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Renamed Pool' }) }),
      );
    });

    it('throws ForbiddenException if not admin', async () => {
      prisma.group.findUnique.mockResolvedValue(MOCK_GROUP);
      await expect(service.update(GROUP_ID, 'stranger', { name: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException if group has started', async () => {
      prisma.group.findUnique.mockResolvedValue({ ...MOCK_GROUP, status: GroupStatus.ACTIVE });
      await expect(service.update(GROUP_ID, ADMIN_ID, { name: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── inviteMember ──────────────────────────────────────────────────────────────

  describe('inviteMember', () => {
    it('creates invited member, stores token, and sends SMS', async () => {
      prisma.group.findUnique.mockResolvedValue(MOCK_GROUP);
      prisma.groupMember.count.mockResolvedValue(1);
      prisma.groupMember.findUnique.mockResolvedValue(null);

      const result = await service.inviteMember(GROUP_ID, ADMIN_ID, { phone: '+2348099998888' });

      expect(prisma.groupMember.upsert).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^invite:/),
        expect.any(String),
        expect.any(Number),
      );
      expect(termii.send).toHaveBeenCalledWith('+2348099998888', expect.stringContaining('Test Pool'));
      expect(result).toHaveProperty('token');
    });

    it('throws BadRequestException when group is at capacity', async () => {
      prisma.group.findUnique.mockResolvedValue(MOCK_GROUP);
      prisma.groupMember.count.mockResolvedValue(5); // == maxMembers
      await expect(service.inviteMember(GROUP_ID, ADMIN_ID, { phone: '+1' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws NotFoundException when user not found', async () => {
      prisma.group.findUnique.mockResolvedValue(MOCK_GROUP);
      prisma.groupMember.count.mockResolvedValue(1);
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.inviteMember(GROUP_ID, ADMIN_ID, { email: 'nobody@x.com' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ConflictException if user already a member', async () => {
      prisma.group.findUnique.mockResolvedValue(MOCK_GROUP);
      prisma.groupMember.count.mockResolvedValue(1);
      prisma.groupMember.findUnique.mockResolvedValue({
        ...MOCK_MEMBER,
        memberStatus: MemberStatus.ACTIVE,
      });
      await expect(service.inviteMember(GROUP_ID, ADMIN_ID, { phone: MOCK_USER.phone })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws ForbiddenException if group has started', async () => {
      prisma.group.findUnique.mockResolvedValue({ ...MOCK_GROUP, status: GroupStatus.ACTIVE });
      await expect(service.inviteMember(GROUP_ID, ADMIN_ID, { phone: '+1' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  // ── joinGroup ─────────────────────────────────────────────────────────────────

  describe('joinGroup', () => {
    const TOKEN = 'a'.repeat(64);
    const tokenPayload = JSON.stringify({ groupId: GROUP_ID, memberId: MEMBER_ID });

    it('accepts invitation and updates member to ACTIVE', async () => {
      redis.get.mockResolvedValue(tokenPayload);
      prisma.groupMember.findUnique.mockResolvedValue(MOCK_MEMBER);

      const result = await service.joinGroup(GROUP_ID, MEMBER_USER_ID, { token: TOKEN });

      expect(prisma.groupMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { memberStatus: MemberStatus.ACTIVE } }),
      );
      expect(redis.del).toHaveBeenCalledWith(`invite:${TOKEN}`);
      expect(result.message).toMatch(/joined/i);
    });

    it('throws BadRequestException for expired token', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.joinGroup(GROUP_ID, MEMBER_USER_ID, { token: TOKEN })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws BadRequestException if token belongs to different group', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ groupId: 'other-group', memberId: MEMBER_ID }));
      await expect(service.joinGroup(GROUP_ID, MEMBER_USER_ID, { token: TOKEN })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws ForbiddenException if token not for current user', async () => {
      redis.get.mockResolvedValue(tokenPayload);
      prisma.groupMember.findUnique.mockResolvedValue({ ...MOCK_MEMBER, userId: 'another-user' });
      await expect(service.joinGroup(GROUP_ID, MEMBER_USER_ID, { token: TOKEN })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws BadRequestException if invitation already used', async () => {
      redis.get.mockResolvedValue(tokenPayload);
      prisma.groupMember.findUnique.mockResolvedValue({
        ...MOCK_MEMBER,
        memberStatus: MemberStatus.ACTIVE,
      });
      await expect(service.joinGroup(GROUP_ID, MEMBER_USER_ID, { token: TOKEN })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  // ── removeMember ──────────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('admin can remove a member from a DRAFT group', async () => {
      prisma.group.findUnique.mockResolvedValue(MOCK_GROUP);
      prisma.groupMember.findFirst.mockResolvedValue(MOCK_MEMBER);

      const result = await service.removeMember(GROUP_ID, ADMIN_ID, MEMBER_ID);

      expect(prisma.groupMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { memberStatus: MemberStatus.REMOVED } }),
      );
      expect(result.message).toMatch(/removed/i);
    });

    it('throws ForbiddenException if not admin', async () => {
      prisma.group.findUnique.mockResolvedValue(MOCK_GROUP);
      await expect(service.removeMember(GROUP_ID, 'stranger', MEMBER_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException if group has started', async () => {
      prisma.group.findUnique.mockResolvedValue({ ...MOCK_GROUP, status: GroupStatus.ACTIVE });
      await expect(service.removeMember(GROUP_ID, ADMIN_ID, MEMBER_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  // ── updatePosition ────────────────────────────────────────────────────────────

  describe('updatePosition', () => {
    it('updates position when slot is free', async () => {
      prisma.group.findUnique.mockResolvedValue(MOCK_GROUP);
      prisma.groupMember.findFirst
        .mockResolvedValueOnce(MOCK_MEMBER) // target
        .mockResolvedValueOnce(null); // occupant (none)

      await service.updatePosition(GROUP_ID, ADMIN_ID, MEMBER_ID, { position: 3 });

      expect(prisma.groupMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { rotationPosition: 3 } }),
      );
    });

    it('three-step swaps when target position is occupied', async () => {
      prisma.group.findUnique.mockResolvedValue(MOCK_GROUP);
      prisma.groupMember.findFirst
        .mockResolvedValueOnce(MOCK_MEMBER) // target
        .mockResolvedValueOnce(MOCK_ADMIN_MEMBER); // occupant at position 1

      await service.updatePosition(GROUP_ID, ADMIN_ID, MEMBER_ID, { position: 1 });

      // Transaction runs 3 updates
      expect(prisma.$.$transaction).toHaveBeenCalled();
    });

    it('throws ForbiddenException if group has started', async () => {
      prisma.group.findUnique.mockResolvedValue({ ...MOCK_GROUP, status: GroupStatus.ACTIVE });
      await expect(
        service.updatePosition(GROUP_ID, ADMIN_ID, MEMBER_ID, { position: 2 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── startGroup ────────────────────────────────────────────────────────────────

  describe('startGroup', () => {
    it('starts group and calls generateCycles', async () => {
      prisma.group.findUnique.mockResolvedValue(MOCK_GROUP);
      prisma.groupMember.findMany.mockResolvedValue([MOCK_ADMIN_MEMBER, MOCK_MEMBER]);

      const result = await service.startGroup(GROUP_ID, ADMIN_ID);

      expect(prisma.group.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: GroupStatus.ACTIVE } }),
      );
      expect(rotation.generateCycles).toHaveBeenCalled();
      expect(result.cyclesGenerated).toBe(2);
    });

    it('throws BadRequestException if fewer than 2 active members', async () => {
      prisma.group.findUnique.mockResolvedValue(MOCK_GROUP);
      prisma.groupMember.findMany.mockResolvedValue([MOCK_ADMIN_MEMBER]); // only 1

      await expect(service.startGroup(GROUP_ID, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException if no startDate', async () => {
      prisma.group.findUnique.mockResolvedValue({ ...MOCK_GROUP, startDate: null });
      await expect(service.startGroup(GROUP_ID, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException if group already started', async () => {
      prisma.group.findUnique.mockResolvedValue({ ...MOCK_GROUP, status: GroupStatus.ACTIVE });
      await expect(service.startGroup(GROUP_ID, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
