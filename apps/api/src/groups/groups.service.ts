import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GroupStatus, MemberStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TermiiService } from '../auth/termii.service';
import { RotationService } from './rotation.service';
import {
  NOTIFICATION_EVENTS,
  GroupInvitedEvent,
  GroupStartedEvent,
} from '../notifications/events/notification.events';
import type { CreateGroupDto } from './dto/create-group.dto';
import type { UpdateGroupDto } from './dto/update-group.dto';
import type { InviteMemberDto } from './dto/invite-member.dto';
import type { JoinGroupDto } from './dto/join-group.dto';
import type { UpdatePositionDto } from './dto/update-position.dto';

const INVITE_TTL = 60 * 60 * 24 * 7; // 7 days

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly termii: TermiiService,
    private readonly rotation: RotationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(adminId: string, dto: CreateGroupDto) {
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
          penaltyConfig: dto.penaltyConfig as Prisma.InputJsonValue | undefined,
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
        members: {
          where: { memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true } },
          },
          orderBy: { rotationPosition: 'asc' },
        },
        cycles: { orderBy: { cycleNumber: 'asc' } },
      },
    });

    if (!group) throw new NotFoundException('Group not found');

    const isMember = group.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Not a member of this group');

    return group;
  }

  async update(groupId: string, adminId: string, dto: UpdateGroupDto) {
    const group = await this.ensureAdmin(groupId, adminId);

    if (group.status !== GroupStatus.DRAFT) {
      throw new ForbiddenException('Cannot update a group that has already started');
    }

    const { penaltyConfig, startDate, ...rest } = dto;
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

  async joinGroup(groupId: string, userId: string, dto: JoinGroupDto) {
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

    return { message: 'Joined group successfully' };
  }

  async acceptInvite(groupId: string, userId: string) {
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

    if (activeMembers.length < 2) {
      throw new BadRequestException('Group needs at least 2 active members to start');
    }

    await this.prisma.group.update({
      where: { id: groupId },
      data: { status: GroupStatus.ACTIVE },
    });

    await this.rotation.generateCycles(
      { id: group.id, frequency: group.frequency, startDate: group.startDate, status: GroupStatus.ACTIVE },
      activeMembers,
    );

    const evt: GroupStartedEvent = {
      memberUserIds: activeMembers.map((m) => m.userId),
      groupName: group.name,
    };
    this.eventEmitter.emit(NOTIFICATION_EVENTS.GROUP_STARTED, evt);

    return { message: 'Group started successfully', cyclesGenerated: activeMembers.length };
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
