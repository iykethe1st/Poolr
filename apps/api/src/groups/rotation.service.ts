import { Injectable } from "@nestjs/common";
import { ContribStatus, Frequency, GroupStatus, MemberStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

interface GroupForRotation {
  id: string;
  frequency: Frequency;
  startDate: Date;
  status: GroupStatus;
  contributionAmount: number;
}

interface MemberForRotation {
  id: string;
  userId: string;
  rotationPosition: number;
  memberStatus: MemberStatus;
}

@Injectable()
export class RotationService {
  constructor(private readonly prisma: PrismaService) {}

  async generateCycles(
    group: GroupForRotation,
    members: MemberForRotation[],
  ): Promise<void> {
    const sorted = [...members].sort(
      (a, b) => a.rotationPosition - b.rotationPosition,
    );

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      for (let index = 0; index < sorted.length; index++) {
        const member = sorted[index];
        const dueDate = addInterval(group.startDate, group.frequency, index);
        const isFirst = index === 0;

        const cycle = await tx.cycle.create({
          data: {
            groupId: group.id,
            recipientId: member.userId,
            cycleNumber: index + 1,
            dueDate,
            status: isFirst ? 'ACTIVE' : 'PENDING',
          },
        });

        // Pre-create a PENDING contribution for every member in the first cycle
        // so the dashboard shows upcoming payments immediately after the group starts.
        if (isFirst) {
          for (const m of sorted) {
            await tx.contribution.create({
              data: {
                cycleId: cycle.id,
                memberId: m.id,
                amount: group.contributionAmount,
                dueAt: dueDate,
                status: ContribStatus.PENDING,
              },
            });
          }
        }
      }
    });
  }
}

function addInterval(base: Date, frequency: Frequency, index: number): Date {
  const d = new Date(base);
  if (frequency === Frequency.WEEKLY) d.setDate(d.getDate() + index * 7);
  else if (frequency === Frequency.BIWEEKLY)
    d.setDate(d.getDate() + index * 14);
  else d.setMonth(d.getMonth() + index);
  return d;
}
