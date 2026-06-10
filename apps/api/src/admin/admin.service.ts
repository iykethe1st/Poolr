import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ContribStatus,
  MemberStatus,
  PayoutStatus,
  PenaltyStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PayoutJobData } from '../scheduler/events/payout.events';
import { WaivePenaltyDto } from '../penalties/dto/waive-penalty.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('payout') private readonly payoutQueue: Queue<PayoutJobData>,
  ) {}

  // ── Groups ────────────────────────────────────────────────────────────────

  async listGroups() {
    const groups = await this.prisma.group.findMany({
      include: {
        admin: { select: { id: true, fullName: true, email: true } },
        _count: {
          select: {
            members: true,
            cycles: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Attach paid-contribution totals per group
    const groupIds = groups.map((g) => g.id);
    const totals = await this.prisma.contribution.groupBy({
      by: ['cycleId'],
      where: { status: ContribStatus.PAID },
      _sum: { amount: true },
    });

    // Map cycleId → groupId via a separate query only if needed
    const cycleGroups = await this.prisma.cycle.findMany({
      where: { groupId: { in: groupIds } },
      select: { id: true, groupId: true },
    });
    const cycleToGroup = new Map(cycleGroups.map((c) => [c.id, c.groupId]));

    const totalByGroup = new Map<string, number>();
    for (const t of totals) {
      const gId = cycleToGroup.get(t.cycleId);
      if (gId) {
        totalByGroup.set(gId, (totalByGroup.get(gId) ?? 0) + Number(t._sum.amount ?? 0));
      }
    }

    return groups.map((g) => ({
      ...g,
      stats: {
        totalMembers: g._count.members,
        totalCycles: g._count.cycles,
        totalCollectedNgn: totalByGroup.get(g.id) ?? 0,
      },
    }));
  }

  // ── Cycle summary ─────────────────────────────────────────────────────────

  async getCycleSummary(groupId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const cycles = await this.prisma.cycle.findMany({
      where: { groupId },
      include: {
        recipient: { select: { id: true, fullName: true } },
        contributions: {
          include: {
            member: {
              include: { user: { select: { id: true, fullName: true } } },
            },
          },
        },
        payouts: {
          select: { id: true, amount: true, status: true, completedAt: true },
        },
      },
      orderBy: { cycleNumber: 'asc' },
    });

    return cycles.map((cycle) => {
      const paid = cycle.contributions.filter((c) => c.status === ContribStatus.PAID).length;
      const overdue = cycle.contributions.filter((c) => c.status === ContribStatus.OVERDUE).length;
      const waived = cycle.contributions.filter((c) => c.status === ContribStatus.WAIVED).length;
      const pending = cycle.contributions.filter((c) => c.status === ContribStatus.PENDING).length;

      return {
        id: cycle.id,
        cycleNumber: cycle.cycleNumber,
        dueDate: cycle.dueDate,
        status: cycle.status,
        recipient: cycle.recipient,
        payouts: cycle.payouts,
        summary: { paid, pending, overdue, waived, total: cycle.contributions.length },
        contributions: cycle.contributions.map((c) => ({
          id: c.id,
          memberId: c.memberId,
          memberName: c.member.user.fullName,
          userId: c.member.userId,
          amount: c.amount,
          status: c.status,
          dueAt: c.dueAt,
          paidAt: c.paidAt,
        })),
      };
    });
  }

  // ── Members ───────────────────────────────────────────────────────────────

  async getMembers(groupId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    return this.prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            status: true,
            kycProfile: { select: { kycStatus: true, kycAttempts: true, verifiedAt: true } },
          },
        },
        contributions: {
          select: { id: true, amount: true, status: true, dueAt: true, paidAt: true },
          orderBy: { dueAt: 'desc' },
          take: 10,
        },
        penalties: {
          where: { status: { not: PenaltyStatus.WAIVED } },
          select: { id: true, penaltyAmount: true, reason: true, status: true, appliedAt: true },
        },
      },
      orderBy: { rotationPosition: 'asc' },
    });
  }

  // ── Trigger payout ────────────────────────────────────────────────────────

  async triggerPayout(groupId: string, cycleId: string): Promise<{ message: string; jobId: string }> {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: { group: { select: { id: true, name: true } } },
    });

    if (!cycle || cycle.groupId !== groupId) {
      throw new NotFoundException('Cycle not found in this group');
    }

    const existing = await this.prisma.payout.findFirst({
      where: {
        cycleId,
        status: { in: [PayoutStatus.INITIATED, PayoutStatus.COMPLETED] },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Payout already ${existing.status.toLowerCase()} for this cycle`,
      );
    }

    const jobId = `admin_payout_${cycleId}_${Date.now()}`;
    await this.payoutQueue.add(
      'disburse',
      { cycleId, recipientId: cycle.recipientId, groupId },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Admin manually triggered payout for cycle ${cycleId} in group "${cycle.group.name}" (job: ${jobId})`,
    );

    return { message: 'Payout job enqueued', jobId };
  }

  // ── Penalties ─────────────────────────────────────────────────────────────

  async listPendingPenalties() {
    return this.prisma.penalty.findMany({
      where: { status: PenaltyStatus.APPLIED },
      include: {
        member: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
            group: { select: { id: true, name: true } },
          },
        },
        contribution: {
          select: { id: true, amount: true, dueAt: true, paidAt: true },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  async waivePenalty(penaltyId: string, dto: WaivePenaltyDto): Promise<{ message: string }> {
    const penalty = await this.prisma.penalty.findUnique({ where: { id: penaltyId } });
    if (!penalty) throw new NotFoundException('Penalty not found');
    if (penalty.status === PenaltyStatus.WAIVED) {
      throw new ConflictException('Penalty is already waived');
    }

    if (dto.reason) {
      this.logger.log(`Admin waived penalty ${penaltyId}. Reason: ${dto.reason}`);
    }

    await this.prisma.penalty.update({
      where: { id: penaltyId },
      data: { status: PenaltyStatus.WAIVED },
    });

    return { message: 'Penalty waived successfully' };
  }

  // ── Users (super-admin) ───────────────────────────────────────────────────

  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        kycProfile: {
          select: {
            kycStatus: true,
            kycAttempts: true,
            verifiedAt: true,
          },
        },
        _count: {
          select: { groupMemberships: { where: { memberStatus: MemberStatus.ACTIVE } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
