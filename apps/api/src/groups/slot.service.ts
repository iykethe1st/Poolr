import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { MemberStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { getMaxSlotsEligible, getTier } from '../users/trust-score.service';

const MIN_SLOT_SPACING = 3;

@Injectable()
export class SlotService {
  constructor(private readonly prisma: PrismaService) {}

  async requestSlots(userId: string, groupId: string, requestedSlotCount: number): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { trustScore: true, status: true },
    });

    if (user.status === 'FROZEN' || user.status === 'BANNED') {
      throw new ForbiddenException('Your account status prevents joining new groups');
    }

    const maxSlots = getMaxSlotsEligible(user.trustScore);
    if (requestedSlotCount > maxSlots) {
      throw new ForbiddenException(
        `SLOT_LIMIT_EXCEEDED: You can hold at most ${maxSlots} slot(s) in a group at your current tier (${getTier(user.trustScore)}). Reach Reliable tier (60+ score) to unlock a 2nd slot.`,
      );
    }

    const group = await this.prisma.group.findUniqueOrThrow({ where: { id: groupId }, select: { maxMembers: true } });

    const currentCount = await this.prisma.groupMember.count({
      where: { groupId, memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
    });

    if (currentCount + requestedSlotCount > group.maxMembers) {
      throw new BadRequestException('Not enough open slots in this group to accommodate your request');
    }

    const existingSlots = await this.prisma.groupMember.findMany({
      where: { groupId, userId, memberStatus: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } },
    });

    const nextSlotNumber = existingSlots.length + 1;

    for (let i = 0; i < requestedSlotCount; i++) {
      await this.prisma.groupMember.create({
        data: {
          groupId,
          userId,
          slotNumber: nextSlotNumber + i,
          rotationPosition: currentCount + 1 + i,
          memberStatus: MemberStatus.INVITED,
        },
      });
    }
  }

  /** Validates that no two slots of the same user are within MIN_SLOT_SPACING positions. */
  async validateSlotSpacing(groupId: string): Promise<{ valid: boolean; conflicts: string[] }> {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId, memberStatus: MemberStatus.ACTIVE },
      include: { user: { select: { fullName: true } } },
      orderBy: { rotationPosition: 'asc' },
    });

    // Group slots by userId
    const byUser = new Map<string, { rotationPosition: number; fullName: string }[]>();
    for (const m of members) {
      if (!byUser.has(m.userId)) byUser.set(m.userId, []);
      byUser.get(m.userId)!.push({ rotationPosition: m.rotationPosition, fullName: m.user.fullName });
    }

    const conflicts: string[] = [];
    for (const [, slots] of byUser) {
      if (slots.length < 2) continue;
      for (let i = 0; i < slots.length - 1; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const spacing = Math.abs(slots[j].rotationPosition - slots[i].rotationPosition);
          if (spacing < MIN_SLOT_SPACING) {
            conflicts.push(
              `${slots[0].fullName}: positions ${slots[i].rotationPosition} and ${slots[j].rotationPosition} are only ${spacing} apart (minimum ${MIN_SLOT_SPACING})`,
            );
          }
        }
      }
    }

    return { valid: conflicts.length === 0, conflicts };
  }

  async offerAdditionalSlot(groupId: string, userId: string, adminId: string): Promise<void> {
    const group = await this.prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { adminId: true, status: true, maxMembers: true },
    });

    if (group.adminId !== adminId) {
      throw new ForbiddenException('Only the group admin can offer additional slots');
    }
    if (group.status !== 'DRAFT') {
      throw new ForbiddenException('Additional slots can only be offered before the group starts');
    }

    await this.requestSlots(userId, groupId, 1);
  }

  async getUserSlots(userId: string, groupId: string) {
    return this.prisma.groupMember.findMany({
      where: { groupId, userId },
      orderBy: { slotNumber: 'asc' },
    });
  }

  async getMultiSlotMembers(groupId: string) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId, memberStatus: MemberStatus.ACTIVE },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { rotationPosition: 'asc' },
    });

    const byUser = new Map<string, { userId: string; fullName: string; positions: number[] }>();
    for (const m of members) {
      if (!byUser.has(m.userId)) {
        byUser.set(m.userId, { userId: m.userId, fullName: m.user.fullName, positions: [] });
      }
      byUser.get(m.userId)!.positions.push(m.rotationPosition);
    }

    return [...byUser.values()]
      .filter((u) => u.positions.length > 1)
      .map((u) => ({ ...u, slotCount: u.positions.length }));
  }
}
