import { Injectable } from '@nestjs/common';
import { Frequency, GroupStatus, MemberStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

interface GroupForRotation {
  id: string;
  frequency: Frequency;
  startDate: Date;
  status: GroupStatus;
}

interface MemberForRotation {
  userId: string;
  rotationPosition: number;
  memberStatus: MemberStatus;
}

@Injectable()
export class RotationService {
  constructor(private readonly prisma: PrismaService) {}

  async generateCycles(group: GroupForRotation, members: MemberForRotation[]): Promise<void> {
    const sorted = [...members].sort((a, b) => a.rotationPosition - b.rotationPosition);

    const cycleData = sorted.map((member, index) => ({
      groupId: group.id,
      recipientId: member.userId,
      cycleNumber: index + 1,
      dueDate: addInterval(group.startDate, group.frequency, index),
      status: 'PENDING' as const,
    }));

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const data of cycleData) {
        await tx.cycle.create({ data });
      }
    });
  }
}

function addInterval(base: Date, frequency: Frequency, index: number): Date {
  const d = new Date(base);
  if (frequency === Frequency.WEEKLY) d.setDate(d.getDate() + index * 7);
  else if (frequency === Frequency.BIWEEKLY) d.setDate(d.getDate() + index * 14);
  else d.setMonth(d.getMonth() + index); // MONTHLY
  return d;
}
