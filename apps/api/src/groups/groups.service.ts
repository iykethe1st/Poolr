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
import { getTier, getMaxSlotsEligible } from '../users/trust-score.service';

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
          minTrustScore: dto.minTrustScore ?? null,
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
        deletedAt: null,
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
      where: { id: groupId, deletedAt: null },
      include: {
        groupAccount: true,
        members: {
          where: { memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true, kycProfile: { select: { kycStatus: true } } } },
          },
          orderBy: { rotationPosition: 'asc' },
        },
        cycles: {
          orderBy: { cycleNumber: 'asc' },
          include: {
            contributions: {
              select: {
                id: true,
                memberId: true,
                amount: true,
                status: true,
                paidAt: true,
              },
            },
          },
        },
      },
    });

    if (!group) throw new NotFoundException('Group not found');

    const isMember = group.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Not a member of this group');

    // Fetch trust scores for all members and attach tier
    const memberUserIds = [...new Set(group.members.map((m) => m.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: memberUserIds } },
      select: { id: true, trustScore: true, status: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const membersWithTier = group.members.map((m) => {
      const u = userMap.get(m.userId);
      const score = u?.trustScore ?? 0;
      return { ...m, tier: getTier(score), trustScore: score, userStatus: u?.status };
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

    const existingSlots = await this.prisma.groupMember.findMany({
      where: { groupId, userId: user.id, memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
    });

    const userScore = await this.prisma.user.findUnique({ where: { id: user.id }, select: { trustScore: true } });
    const maxSlots = getMaxSlotsEligible(userScore?.trustScore ?? 0);
    const slotCount = (dto as { slotCount?: number }).slotCount ?? 1;

    if (existingSlots.length + slotCount > maxSlots) {
      throw new BadRequestException(
        `User can hold at most ${maxSlots} slot(s) in this group based on their trust tier (${getTier(userScore?.trustScore ?? 0)}).`,
      );
    }

    if (currentCount + slotCount > group.maxMembers) {
      throw new BadRequestException('Not enough open slots to accommodate requested slot count');
    }

    const nextSlotNumber = existingSlots.length + 1;
    const createdMembers: { id: string }[] = [];

    for (let i = 0; i < slotCount; i++) {
      const m = await this.prisma.groupMember.create({
        data: {
          groupId,
          userId: user.id,
          slotNumber: nextSlotNumber + i,
          rotationPosition: currentCount + 1 + i,
          memberStatus: MemberStatus.INVITED,
        },
      });
      createdMembers.push(m);
    }

    const token = randomBytes(32).toString('hex');
    await this.redis.set(`invite:${token}`, JSON.stringify({ groupId, userId: user.id }), INVITE_TTL);

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

    return { message: 'Invitation sent', memberIds: createdMembers.map((m) => m.id), slotCount, token };
  }

  private async assertUserCanJoin(userId: string, group?: { minTrustScore?: number | null }): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true, trustScore: true } });
    if (user?.status === UserStatus.BANNED) {
      throw new ForbiddenException('Your account has been banned. Contact support to resolve your outstanding debt.');
    }
    if (user?.status === UserStatus.FROZEN) {
      throw new ForbiddenException('Your account is frozen due to an outstanding debt. Please clear your debt first.');
    }
    if (group?.minTrustScore != null && (user?.trustScore ?? 0) < group.minTrustScore) {
      throw new ForbiddenException(
        `This group requires a minimum trust score of ${group.minTrustScore}. Your current score is ${user?.trustScore ?? 0}.`,
      );
    }
  }

  async joinGroup(groupId: string, userId: string, dto: JoinGroupDto) {
    const raw = await this.redis.get(`invite:${dto.token}`);
    if (!raw) throw new BadRequestException('Invalid or expired invitation token');

    const { groupId: tokenGroupId, userId: tokenUserId } = JSON.parse(raw) as {
      groupId: string;
      userId: string;
    };

    if (tokenGroupId !== groupId) {
      throw new BadRequestException('Token does not belong to this group');
    }
    if (tokenUserId !== userId) throw new ForbiddenException('This invitation is not for you');

    // Delegate to acceptInvite which handles slot creation + tier checks
    const result = await this.acceptInvite(groupId, userId, dto.slotCount ?? 1);
    await this.redis.del(`invite:${dto.token}`);
    return result;
  }

  async joinByToken(userId: string, token: string, slotCount = 1) {
    const raw = await this.redis.get(`invite:${token}`);
    if (!raw) throw new BadRequestException('Invalid or expired invitation token');

    const { groupId, userId: tokenUserId } = JSON.parse(raw) as { groupId: string; userId: string };
    if (tokenUserId !== userId) throw new ForbiddenException('This invitation is not for you');

    // Reuse acceptInvite logic (handles slot creation, tier check, activation)
    const result = await this.acceptInvite(groupId, userId, slotCount);
    await this.redis.del(`invite:${token}`);

    return { ...result, message: 'Joined group successfully' };
  }

  async acceptInvite(groupId: string, userId: string, slotCount = 1) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { minTrustScore: true, maxMembers: true },
    });
    await this.assertUserCanJoin(userId, group ?? undefined);

    const userRow = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { trustScore: true },
    });
    const maxSlots = getMaxSlotsEligible(userRow?.trustScore ?? 0);
    if (slotCount > maxSlots) {
      throw new ForbiddenException(
        `SLOT_LIMIT_EXCEEDED: Your trust tier allows at most ${maxSlots} slot(s). Reach Reliable tier (60+ score) to unlock a 2nd slot.`,
      );
    }

    const pendingSlots = await this.prisma.groupMember.findMany({
      where: { groupId, userId, memberStatus: MemberStatus.INVITED },
      orderBy: { slotNumber: 'asc' },
    });

    if (pendingSlots.length === 0) {
      const existing = await this.prisma.groupMember.findFirst({ where: { groupId, userId } });
      if (existing?.memberStatus === MemberStatus.ACTIVE) {
        throw new ConflictException('You are already a member of this group');
      }
      throw new NotFoundException('No pending invitation found');
    }

    // Remove excess slots if user wants fewer than were pre-created
    if (slotCount < pendingSlots.length) {
      const toRemove = pendingSlots.slice(slotCount);
      await this.prisma.groupMember.deleteMany({ where: { id: { in: toRemove.map((m) => m.id) } } });
    }

    // Create additional slots if user wants more than were pre-created
    if (slotCount > pendingSlots.length) {
      const occupiedCount = await this.prisma.groupMember.count({
        where: { groupId, memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
      });
      const additionalNeeded = slotCount - pendingSlots.length;
      if (occupiedCount + additionalNeeded > (group?.maxMembers ?? 0)) {
        throw new BadRequestException('Not enough open slots in this group for your request');
      }
      const maxRotation = await this.prisma.groupMember.aggregate({
        where: { groupId },
        _max: { rotationPosition: true },
      });
      let nextPosition = (maxRotation._max.rotationPosition ?? 0) + 1;
      const nextSlotNumber = pendingSlots.length + 1;
      for (let i = 0; i < additionalNeeded; i++) {
        await this.prisma.groupMember.create({
          data: {
            groupId,
            userId,
            slotNumber: nextSlotNumber + i,
            rotationPosition: nextPosition + i,
            memberStatus: MemberStatus.INVITED,
          },
        });
      }
    }

    await this.prisma.groupMember.updateMany({
      where: { groupId, userId, memberStatus: MemberStatus.INVITED },
      data: { memberStatus: MemberStatus.ACTIVE },
    });

    this.emitMemberJoined(groupId, userId).catch(() => null);

    return { message: 'Invitation accepted', slotCount };
  }

  async updateMySlots(groupId: string, userId: string, slotCount: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { status: true, maxMembers: true },
    });
    if (!group) throw new NotFoundException('Group not found');
    if (group.status !== GroupStatus.DRAFT) {
      throw new ForbiddenException('Slot count can only be changed before the group starts');
    }

    const userRow = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { trustScore: true },
    });
    const maxSlots = getMaxSlotsEligible(userRow?.trustScore ?? 0);
    if (slotCount > maxSlots) {
      throw new ForbiddenException(
        `Your trust tier allows at most ${maxSlots} slot(s).`,
      );
    }

    const existingSlots = await this.prisma.groupMember.findMany({
      where: { groupId, userId, memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
      orderBy: { slotNumber: 'asc' },
    });
    if (existingSlots.length === 0) throw new NotFoundException('You are not a member of this group');

    const currentCount = existingSlots.length;
    if (slotCount === currentCount) return { message: 'No change', slotCount };

    if (slotCount < currentCount) {
      const toRemove = existingSlots.slice(slotCount);
      await this.prisma.groupMember.deleteMany({ where: { id: { in: toRemove.map((m) => m.id) } } });
    } else {
      const totalOccupied = await this.prisma.groupMember.count({
        where: { groupId, memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
      });
      const additionalNeeded = slotCount - currentCount;
      if (totalOccupied + additionalNeeded > group.maxMembers) {
        throw new BadRequestException('Not enough open slots in this group');
      }
      const maxRotation = await this.prisma.groupMember.aggregate({
        where: { groupId },
        _max: { rotationPosition: true },
      });
      const nextPosition = (maxRotation._max.rotationPosition ?? 0) + 1;
      const nextSlotNumber = currentCount + 1;
      for (let i = 0; i < additionalNeeded; i++) {
        await this.prisma.groupMember.create({
          data: {
            groupId,
            userId,
            slotNumber: nextSlotNumber + i,
            rotationPosition: nextPosition + i,
            memberStatus: MemberStatus.ACTIVE,
          },
        });
      }
    }

    return { message: 'Slot count updated', slotCount };
  }

  async offerSlot(groupId: string, adminId: string, targetUserId: string) {
    const group = await this.ensureAdmin(groupId, adminId);
    if (group.status !== GroupStatus.DRAFT) {
      throw new ForbiddenException('Slots can only be offered before the group starts');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { trustScore: true },
    });
    const maxSlots = getMaxSlotsEligible(targetUser?.trustScore ?? 0);

    const existingSlots = await this.prisma.groupMember.findMany({
      where: { groupId, userId: targetUserId, memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
    });
    if (existingSlots.length === 0) throw new NotFoundException('Member not found in this group');
    if (existingSlots.length >= maxSlots) {
      throw new ForbiddenException(`This member already holds the maximum slots for their tier (${maxSlots}).`);
    }

    const totalOccupied = await this.prisma.groupMember.count({
      where: { groupId, memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
    });
    if (totalOccupied >= group.maxMembers) {
      throw new BadRequestException('No open slots remaining in this group');
    }

    const maxRotation = await this.prisma.groupMember.aggregate({
      where: { groupId },
      _max: { rotationPosition: true },
    });
    await this.prisma.groupMember.create({
      data: {
        groupId,
        userId: targetUserId,
        slotNumber: existingSlots.length + 1,
        rotationPosition: (maxRotation._max.rotationPosition ?? 0) + 1,
        memberStatus: MemberStatus.INVITED,
      },
    });

    return { message: 'Slot offer sent' };
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

  async deleteGroup(groupId: string, adminId: string) {
    const group = await this.ensureAdmin(groupId, adminId);

    if (group.status === GroupStatus.ACTIVE) {
      throw new ForbiddenException('Cannot delete an active group. End the group first.');
    }

    await this.prisma.group.update({
      where: { id: groupId },
      data: { deletedAt: new Date(), status: GroupStatus.CANCELLED },
    });

    return { message: 'Group deleted' };
  }

  async removeMember(groupId: string, adminId: string, memberId: string) {
    const group = await this.ensureAdmin(groupId, adminId);

    if (group.status === GroupStatus.ACTIVE) {
      throw new ForbiddenException('Cannot remove members while the group is active');
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

    // Provision dedicated virtual account (idempotent â€” skipped if already exists)
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

    // Fetch trust scores for all members
    const histUserIds = [...new Set(allMembers.map((m) => m.userId))];
    const histUsers = await this.prisma.user.findMany({
      where: { id: { in: histUserIds } },
      select: { id: true, trustScore: true, status: true },
    });
    const histUserMap = new Map(histUsers.map((u) => [u.id, u]));
    const allMembersWithTier = allMembers.map((m) => {
      const u = histUserMap.get(m.userId);
      const score = u?.trustScore ?? 0;
      return { ...m, tier: getTier(score), trustScore: score, userStatus: u?.status };
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
