import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ContribStatus,
  PenaltyReason,
  PenaltyStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  NOTIFICATION_EVENTS,
  PenaltyAppliedEvent,
} from '../notifications/events/notification.events';
import {
  DEFAULT_PENALTY_CONFIG,
  PenaltyConfig,
  calculatePenaltyAmount,
  parsePenaltyConfig,
} from './penalty-config';
import { WaivePenaltyDto } from './dto/waive-penalty.dto';

type ContributionWithRelations = Prisma.ContributionGetPayload<{
  include: {
    member: true;
    cycle: { include: { group: true } };
  };
}>;

@Injectable()
export class PenaltiesService {
  private readonly logger = new Logger(PenaltiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('0 1 * * *')
  async applyMissedPenalties(): Promise<void> {
    const now = new Date();

    const pending = await this.prisma.contribution.findMany({
      where: { status: ContribStatus.PENDING, dueAt: { lt: now } },
      include: { member: true, cycle: { include: { group: true } } },
    });

    if (pending.length === 0) return;
    this.logger.log(`Penalty detection: ${pending.length} overdue contribution(s)`);

    for (const contrib of pending) {
      const config = parsePenaltyConfig(contrib.cycle.group.penaltyConfig);
      const dueWithGrace = new Date(
        contrib.dueAt.getTime() + config.gracePeriodHours * 3_600_000,
      );
      if (now < dueWithGrace) continue;

      await this.applyPenalty(contrib, config).catch((err: unknown) => {
        this.logger.error(
          `Failed to apply penalty for contribution ${contrib.id}: ${(err as Error).message}`,
        );
      });
    }
  }

  async applyPenalty(
    contribution: ContributionWithRelations,
    config?: PenaltyConfig,
  ): Promise<void> {
    const existing = await this.prisma.penalty.findFirst({
      where: { contributionId: contribution.id },
    });
    if (existing) return;

    const effectiveConfig =
      config ?? parsePenaltyConfig(contribution.cycle.group.penaltyConfig ?? DEFAULT_PENALTY_CONFIG);
    const penaltyAmount = calculatePenaltyAmount(
      effectiveConfig,
      Number(contribution.amount),
    );

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.contribution.update({
        where: { id: contribution.id },
        data: { status: ContribStatus.OVERDUE },
      });
      await tx.penalty.create({
        data: {
          contributionId: contribution.id,
          memberId: contribution.memberId,
          penaltyAmount,
          reason: PenaltyReason.MISSED_PAYMENT,
          status: PenaltyStatus.APPLIED,
          appliedAt: new Date(),
        },
      });
    });

    const evt: PenaltyAppliedEvent = {
      userId: contribution.member.userId,
      amountNgn: penaltyAmount,
      groupName: contribution.cycle.group.name,
    };
    this.eventEmitter.emit(NOTIFICATION_EVENTS.PENALTY_APPLIED, evt);

    this.logger.log(
      `Penalty applied for contribution ${contribution.id}: ₦${penaltyAmount} NGN`,
    );
  }

  async listMyPenalties(userId: string) {
    const members = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { id: true },
    });
    const memberIds = members.map((m) => m.id);

    return this.prisma.penalty.findMany({
      where: { memberId: { in: memberIds } },
      include: {
        contribution: {
          include: {
            cycle: { include: { group: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async waivePenalty(
    penaltyId: string,
    adminId: string,
    dto: WaivePenaltyDto,
  ): Promise<{ message: string }> {
    const penalty = await this.prisma.penalty.findUnique({
      where: { id: penaltyId },
      include: {
        contribution: { include: { cycle: { include: { group: true } } } },
      },
    });

    if (!penalty) throw new NotFoundException('Penalty not found');
    if (penalty.status === PenaltyStatus.WAIVED)
      throw new BadRequestException('Penalty is already waived');
    if (penalty.contribution.cycle.group.adminId !== adminId)
      throw new ForbiddenException('Only the group admin can waive penalties');

    if (dto.reason) {
      this.logger.log(
        `Penalty ${penaltyId} waived by admin ${adminId}. Reason: ${dto.reason}`,
      );
    }

    await this.prisma.penalty.update({
      where: { id: penaltyId },
      data: { status: PenaltyStatus.WAIVED },
    });

    return { message: 'Penalty waived successfully' };
  }
}
