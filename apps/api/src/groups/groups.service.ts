import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { ContribStatus, CycleStatus, GroupStatus, MemberStatus, UserStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TermiiService } from '../auth/termii.service';
import { RotationService } from './rotation.service';
import { PaystackService } from '../payments/paystack.service';
import {
  NOTIFICATION_EVENTS,
  GroupInvitedEvent,
  GroupStartedEvent,
  MemberJoinedEvent,
  MemberLeftEvent,
} from '../notifications/events/notification.events';
import type { CreateGroupDto } from './dto/create-group.dto';
import type { UpdateGroupDto } from './dto/update-group.dto';
import type { InviteMemberDto } from './dto/invite-member.dto';
import type { JoinGroupDto } from './dto/join-group.dto';
import type { UpdatePositionDto } from './dto/update-position.dto';
import { computeTier } from '../users/users.service';

const INVITE_TTL = 60 * 60 * 24 * 7; // 7 days

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly termii: TermiiService,
    private readonly rotation: RotationService,
    private readonly paystack: PaystackService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  async create(adminId: string, dto: CreateGroupDto) {
    const penaltyPct = this.config.get<number>('PENALTY_PERCENTAGE_DEFAULT', 5);
    const penaltyConfig = dto.penaltyEnabled
      ? { type: 'percentage', amount: penaltyPct, gracePeriodHours: 24 }
      : null;

    return this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      const group = await tx.group.create({
        data: {
          adminId,
          name: dto.name,
          contributionAmount: dto.contributionAmount,
          frequency: dto.frequency,
          maxMembers: dto.maxMembers,
          currency: dto.currency ?? 'NGN',
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          penaltyConfig: penaltyConfig as Prisma.InputJsonValue | undefined,
        },
      });

      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId: adminId,
          rotationPosition: 1,
          memberStatus: MemberStatus.ACTIVE,
        },
      });

      return group;
    });
  }

  async findAll(userId: string) {
    return this.prisma.group.findMany({
      where: {
        members: {
          some: {
            userId,
            memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] },
          },
        },
      },
      include: {
        members: {
          where: { memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
          select: { id: true, userId: true, rotationPosition: true, memberStatus: true },
          orderBy: { rotationPosition: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        groupAccount: true,
        members: {
          where: { memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true, kycProfile: { select: { kycStatus: true } } } },
          },
          orderBy: { rotationPosition: 'asc' },
        },
        cycles: { orderBy: { cycleNumber: 'asc' } },
      },
    });

    if (!group) throw new NotFoundException('Group not found');

    const isMember = group.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Not a member of this group');

    // Batch-compute cross-group contribution tier for all members
    const memberUserIds = group.members.map((m) => m.userId);
    const [paidContribs, penaltyCounts] = await Promise.all([
      this.prisma.contribution.findMany({
        where: { member: { userId: { in: memberUserIds } }, status: 'PAID' },
        select: { paidAt: true, dueAt: true, member: { select: { userId: true } } },
      }),
      this.prisma.penalty.findMany({
        where: { member: { userId: { in: memberUserIds } }, status: 'APPLIED' },
        select: { member: { select: { userId: true } } },
      }),
    ]);
    const tierStats: Record<string, { paid: number; onTime: number; penalties: number }> = {};
    for (const c of paidContribs) {
      const uid = c.member.userId;
      if (!tierStats[uid]) tierStats[uid] = { paid: 0, onTime: 0, penalties: 0 };
      tierStats[uid].paid++;
      if (c.paidAt && c.paidAt <= c.dueAt) tierStats[uid].onTime++;
    }
    for (const p of penaltyCounts) {
      const uid = p.member.userId;
      if (!tierStats[uid]) tierStats[uid] = { paid: 0, onTime: 0, penalties: 0 };
      tierStats[uid].penalties++;
    }
    const membersWithTier = group.members.map((m) => {
      const s = tierStats[m.userId] ?? { paid: 0, onTime: 0, penalties: 0 };
      return { ...m, tier: computeTier(s.paid, s.onTime, s.penalties) };
    });

    return { ...group, members: membersWithTier };
  }

  async update(groupId: string, adminId: string, dto: UpdateGroupDto) {
    const group = await this.ensureAdmin(groupId, adminId);

    if (group.status !== GroupStatus.DRAFT) {
      throw new ForbiddenException('Cannot update a group that has already started');
    }

    const { penaltyEnabled, startDate, ...rest } = dto;
    const penaltyPct = this.config.get<number>('PENALTY_PERCENTAGE_DEFAULT', 5);
    const penaltyConfig = penaltyEnabled === undefined
      ? undefined
      : penaltyEnabled
        ? { type: 'percentage', amount: penaltyPct, gracePeriodHours: 24 }
        : null;

    return this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : undefined,
        penaltyConfig: penaltyConfig as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async inviteMember(groupId: string, adminId: string, dto: InviteMemberDto) {
    const group = await this.ensureAdmin(groupId, adminId);

    if (group.status !== GroupStatus.DRAFT) {
      throw new ForbiddenException('Cannot invite members after group has started');
    }

    const currentCount = await this.prisma.groupMember.count({
      where: {
        groupId,
        memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] },
      },
    });

    if (currentCount >= group.maxMembers) {
      throw new BadRequestException('Group is at maximum capacity');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(dto.phone ? [{ phone: dto.phone }] : []),
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
    });

    if (!user) {
      throw new NotFoundException('No registered user found with that phone or email');
    }

    if (user.id === adminId) {
      throw new ConflictException('Admin is already a member of this group');
    }

    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
    });

    if (existing?.memberStatus === MemberStatus.ACTIVE || existing?.memberStatus === MemberStatus.INVITED) {
      throw new ConflictException('User is already a member or has a pending invitation');
    }

    const rotationPosition = currentCount + 1;

    const member = await this.prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId: user.id } },
      create: { groupId, userId: user.id, rotationPosition, memberStatus: MemberStatus.INVITED },
      update: { memberStatus: MemberStatus.INVITED, rotationPosition },
    });

    const token = randomBytes(32).toString('hex');
    await this.redis.set(`invite:${token}`, JSON.stringify({ groupId, memberId: member.id }), INVITE_TTL);

    const smsMessage = `You've been invited to join "${group.name}" on Poolr. Your invite code: ${token}`;
    const notifyPhone = dto.phone ?? user.phone;
    if (notifyPhone) {
      await this.termii.send(notifyPhone, smsMessage);
    }

    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { fullName: true },
    });

    const evt: GroupInvitedEvent = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      groupName: group.name,
      adminName: admin?.fullName ?? 'A Poolr member',
      inviteToken: token,
    };
    this.eventEmitter.emit(NOTIFICATION_EVENTS.GROUP_INVITED, evt);

    return { message: 'Invitation sent', memberId: member.id, token };
  }

  private async assertUserCanJoin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (user?.status === UserStatus.BANNED) {
      throw new ForbiddenException('Your account has been banned. Contact support to resolve your outstanding debt.');
    }
    if (user?.status === UserStatus.FROZEN) {
      throw new ForbiddenException('Your account is frozen due to an outstanding debt. Please clear your debt first.');
    }
  }

  async joinGroup(groupId: string, userId: string, dto: JoinGroupDto) {
    await this.assertUserCanJoin(userId);
    const raw = await this.redis.get(`invite:${dto.token}`);
    if (!raw) throw new BadRequestException('Invalid or expired invitation token');

    const { groupId: tokenGroupId, memberId } = JSON.parse(raw) as {
      groupId: string;
      memberId: string;
    };

    if (tokenGroupId !== groupId) {
      throw new BadRequestException('Token does not belong to this group');
    }

    const member = await this.prisma.groupMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Invitation not found');
    if (member.userId !== userId) throw new ForbiddenException('This invitation is not for you');
    if (member.memberStatus !== MemberStatus.INVITED) {
      throw new BadRequestException('Invitation has already been used');
    }

    await Promise.all([
      this.prisma.groupMember.update({
        where: { id: memberId },
        data: { memberStatus: MemberStatus.ACTIVE },
      }),
      this.redis.del(`invite:${dto.token}`),
    ]);

    this.emitMemberJoined(groupId, userId).catch(() => null);

    return { message: 'Joined group successfully' };
  }

  async joinByToken(userId: string, token: string) {
    await this.assertUserCanJoin(userId);
    const raw = await this.redis.get(`invite:${token}`);
    if (!raw) throw new BadRequestException('Invalid or expired invitation token');

    const { groupId, memberId } = JSON.parse(raw) as { groupId: string; memberId: string };

    const member = await this.prisma.groupMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Invitation not found');
    if (member.userId !== userId) throw new ForbiddenException('This invitation is not for you');
    if (member.memberStatus !== MemberStatus.INVITED) {
      throw new BadRequestException('Invitation has already been used');
    }

    await Promise.all([
      this.prisma.groupMember.update({
        where: { id: memberId },
        data: { memberStatus: MemberStatus.ACTIVE },
      }),
      this.redis.del(`invite:${token}`),
    ]);

    this.emitMemberJoined(groupId, userId).catch(() => null);

    return { message: 'Joined group successfully' };
  }

  async acceptInvite(groupId: string, userId: string) {
    await this.assertUserCanJoin(userId);
    const member = await this.prisma.groupMember.findFirst({
      where: { groupId, userId, memberStatus: MemberStatus.INVITED },
    });

    if (!member) {
      const existing = await this.prisma.groupMember.findFirst({ where: { groupId, userId } });
      if (existing?.memberStatus === MemberStatus.ACTIVE) {
        throw new ConflictException('You are already a member of this group');
      }
      throw new NotFoundException('No pending invitation found');
    }

    await this.prisma.groupMember.update({
      where: { id: member.id },
      data: { memberStatus: MemberStatus.ACTIVE },
    });

    this.emitMemberJoined(groupId, userId).catch(() => null);

    return { message: 'Invitation accepted' };
  }

  async declineInvite(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findFirst({
      where: { groupId, userId, memberStatus: MemberStatus.INVITED },
    });

    if (!member) throw new NotFoundException('No pending invitation found');

    await this.prisma.groupMember.update({
      where: { id: member.id },
      data: { memberStatus: MemberStatus.REMOVED },
    });

    return { message: 'Invitation declined' };
  }

  async removeMember(groupId: string, adminId: string, memberId: string) {
    const group = await this.ensureAdmin(groupId, adminId);

    if (group.status === GroupStatus.ACTIVE || group.status === GroupStatus.COMPLETED) {
      throw new ForbiddenException('Cannot remove members after group has started');
    }

    const member = await this.prisma.groupMember.findFirst({ where: { id: memberId, groupId } });
    if (!member) throw new NotFoundException('Member not found');
    if (member.userId === adminId) throw new ForbiddenException('Admin cannot remove themselves');

    await this.prisma.groupMember.update({
      where: { id: memberId },
      data: { memberStatus: MemberStatus.REMOVED },
    });

    this.emitMemberLeft(groupId, member.userId, group.name).catch(() => null);

    return { message: 'Member removed' };
  }

  async updatePosition(groupId: string, adminId: string, memberId: string, dto: UpdatePositionDto) {
    const group = await this.ensureAdmin(groupId, adminId);

    if (group.status !== GroupStatus.DRAFT) {
      throw new ForbiddenException('Rotation positions cannot be changed after group starts');
    }

    const target = await this.prisma.groupMember.findFirst({ where: { id: memberId, groupId } });
    if (!target) throw new NotFoundException('Member not found');

    if (target.rotationPosition === dto.position) {
      return { message: 'Position unchanged' };
    }

    const occupant = await this.prisma.groupMember.findFirst({
      where: {
        groupId,
        rotationPosition: dto.position,
        memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] },
      },
    });

    if (occupant) {
      // Three-step swap to avoid unique constraint conflict
      await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.groupMember.update({ where: { id: target.id }, data: { rotationPosition: -1 } });
        await tx.groupMember.update({
          where: { id: occupant.id },
          data: { rotationPosition: target.rotationPosition },
        });
        await tx.groupMember.update({
          where: { id: target.id },
          data: { rotationPosition: dto.position },
        });
      });
    } else {
      await this.prisma.groupMember.update({
        where: { id: target.id },
        data: { rotationPosition: dto.position },
      });
    }

    return { message: 'Position updated' };
  }

  async startGroup(groupId: string, adminId: string) {
    const group = await this.ensureAdmin(groupId, adminId);

    if (group.status !== GroupStatus.DRAFT) {
      throw new BadRequestException('Group has already started or is completed');
    }

    if (!group.startDate) {
      throw new BadRequestException('Set a start date before starting the group');
    }

    const activeMembers = await this.prisma.groupMember.findMany({
      where: { groupId, memberStatus: MemberStatus.ACTIVE },
      orderBy: { rotationPosition: 'asc' },
    });

    if (activeMembers.length < 3) {
      throw new BadRequestException('Group needs at least 3 active members to start');
    }

    await this.prisma.group.update({
      where: { id: groupId },
      data: { status: GroupStatus.ACTIVE },
    });

    await this.rotation.generateCycles(
      {
        id: group.id,
        frequency: group.frequency,
        startDate: group.startDate as Date,
        status: GroupStatus.ACTIVE,
        contributionAmount: Number(group.contributionAmount),
      },
      activeMembers,
    );

    // Provision dedicated virtual account (idempotent — skipped if already exists)
    const existingAccount = await this.prisma.groupAccount.findUnique({ where: { groupId } });
    if (!existingAccount) {
      try {
        const { customerCode } = await this.paystack.createCustomer({
          email: `group-${groupId}@poolr.internal`,
          firstName: 'Poolr',
          lastName: group.name.slice(0, 50),
        });
        const dva = await this.paystack.createDedicatedAccount(customerCode);
        await this.prisma.groupAccount.create({
          data: {
            groupId,
            paystackCustomerCode: customerCode,
            accountNumber: dva.accountNumber,
            accountName: dva.accountName,
            bankName: dva.bankName,
          },
        });
        this.logger.log(`DVA provisioned for group ${groupId}: ${dva.accountNumber} (${dva.bankName})`);
      } catch (err: unknown) {
        this.logger.warn(`DVA provisioning failed for group ${groupId}: ${(err as Error).message}`);
      }
    }

    const evt: GroupStartedEvent = {
      memberUserIds: activeMembers.map((m) => m.userId),
      groupName: group.name,
    };
    this.eventEmitter.emit(NOTIFICATION_EVENTS.GROUP_STARTED, evt);

    return { message: 'Group started successfully', cyclesGenerated: activeMembers.length };
  }

  async getGroupHistory(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const myMember = await this.prisma.groupMember.findFirst({ where: { groupId, userId } });
    if (!myMember) throw new ForbiddenException('Not a member of this group');

    const [contributions, payouts, penalties, allMembers, potAgg] = await Promise.all([
      this.prisma.contribution.findMany({
        where: { cycle: { groupId } },
        include: {
          member: { include: { user: { select: { id: true, fullName: true } } } },
          cycle: { select: { cycleNumber: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payout.findMany({
        where: { cycle: { groupId } },
        include: {
          recipient: { select: { id: true, fullName: true } },
          cycle: { select: { cycleNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.penalty.findMany({
        where: { member: { groupId } },
        include: {
          member: { include: { user: { select: { id: true, fullName: true } } } },
          contribution: { include: { cycle: { select: { cycleNumber: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.groupMember.findMany({
        where: { groupId },
        include: { user: { select: { id: true, fullName: true, email: true, kycProfile: { select: { kycStatus: true } } } } },
        orderBy: { rotationPosition: 'asc' },
      }),
      this.prisma.contribution.aggregate({
        where: { cycle: { groupId, status: CycleStatus.ACTIVE }, status: ContribStatus.PAID },
        _sum: { amount: true },
      }),
    ]);

    // Batch-compute cross-group tier for each member
    const histUserIds = allMembers.map((m) => m.userId);
    const [histPaidContribs, histPenalties] = await Promise.all([
      this.prisma.contribution.findMany({
        where: { member: { userId: { in: histUserIds } }, status: 'PAID' },
        select: { paidAt: true, dueAt: true, member: { select: { userId: true } } },
      }),
      this.prisma.penalty.findMany({
        where: { member: { userId: { in: histUserIds } }, status: 'APPLIED' },
        select: { member: { select: { userId: true } } },
      }),
    ]);
    const histTierStats: Record<string, { paid: number; onTime: number; penalties: number }> = {};
    for (const c of histPaidContribs) {
      const uid = c.member.userId;
      if (!histTierStats[uid]) histTierStats[uid] = { paid: 0, onTime: 0, penalties: 0 };
      histTierStats[uid].paid++;
      if (c.paidAt && c.paidAt <= c.dueAt) histTierStats[uid].onTime++;
    }
    for (const p of histPenalties) {
      const uid = p.member.userId;
      if (!histTierStats[uid]) histTierStats[uid] = { paid: 0, onTime: 0, penalties: 0 };
      histTierStats[uid].penalties++;
    }
    const allMembersWithTier = allMembers.map((m) => {
      const s = histTierStats[m.userId] ?? { paid: 0, onTime: 0, penalties: 0 };
      return { ...m, tier: computeTier(s.paid, s.onTime, s.penalties) };
    });

    return {
      contributions,
      payouts,
      penalties,
      allMembers: allMembersWithTier,
      potValueNgn: Number(potAgg._sum.amount ?? 0),
    };
  }

  private async emitMemberJoined(groupId: string, userId: string): Promise<void> {
    const [user, group, others] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { fullName: true } }),
      this.prisma.group.findUniqueOrThrow({ where: { id: groupId }, select: { name: true } }),
      this.prisma.groupMember.findMany({
        where: { groupId, memberStatus: MemberStatus.ACTIVE, userId: { not: userId } },
        select: { userId: true },
      }),
    ]);
    const evt: MemberJoinedEvent = {
      memberName: user.fullName,
      groupName: group.name,
      otherMemberUserIds: others.map((m) => m.userId),
    };
    this.eventEmitter.emit(NOTIFICATION_EVENTS.MEMBER_JOINED, evt);
  }

  private async emitMemberLeft(groupId: string, userId: string, groupName: string): Promise<void> {
    const [user, others] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { fullName: true } }),
      this.prisma.groupMember.findMany({
        where: { groupId, memberStatus: MemberStatus.ACTIVE },
        select: { userId: true },
      }),
    ]);
    const evt: MemberLeftEvent = {
      memberName: user.fullName,
      groupName,
      otherMemberUserIds: others.map((m) => m.userId),
    };
    this.eventEmitter.emit(NOTIFICATION_EVENTS.MEMBER_LEFT, evt);
  }

  private async ensureAdmin(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.adminId !== userId) {
      throw new ForbiddenException('Only the group admin can perform this action');
    }
    return group;
  }
}
