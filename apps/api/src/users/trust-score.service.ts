import { Injectable, Logger } from '@nestjs/common';
import { NotifChannel, TrustScoreEventType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type TrustTier = 'New' | 'Trusted' | 'Reliable' | 'Elite';

export function getTier(score: number): TrustTier {
  if (score >= 80) return 'Elite';
  if (score >= 60) return 'Reliable';
  if (score >= 40) return 'Trusted';
  return 'New';
}

export function getMaxSlotsEligible(score: number): number {
  if (score >= 80) return 3;
  if (score >= 60) return 2;
  return 1;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

const TIER_PERKS: Record<TrustTier, string> = {
  New: 'Standard contribution thresholds apply.',
  Trusted: 'You now receive a 50% discount on flat penalty fees if you default.',
  Reliable: 'You can now hold up to 2 slots in a single group, plus priority rotation positioning.',
  Elite: 'You can now hold up to 3 slots in a single group, plus zero contribution fees on one nominated group per month and priority payout scheduling.',
};

@Injectable()
export class TrustScoreService {
  private readonly logger = new Logger(TrustScoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  getTier(score: number): TrustTier {
    return getTier(score);
  }

  getMaxSlotsEligible(score: number): number {
    return getMaxSlotsEligible(score);
  }

  async applyScoreEvent(
    userId: string,
    eventType: TrustScoreEventType,
    pointsDelta: number,
    reason: string,
    context?: { groupId?: string; contributionId?: string },
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { trustScore: true },
    });
    if (!user) return;

    const scoreBefore = user.trustScore;
    const scoreAfter = clamp(scoreBefore + pointsDelta);

    await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({ where: { id: userId }, data: { trustScore: scoreAfter } });
      await tx.trustScoreEvent.create({
        data: {
          userId,
          eventType,
          pointsDelta,
          scoreBefore,
          scoreAfter,
          reason,
          groupId: context?.groupId ?? null,
          contributionId: context?.contributionId ?? null,
        },
      });
    });

    // Tier-change notification
    const tierBefore = getTier(scoreBefore);
    const tierAfter = getTier(scoreAfter);
    if (tierBefore !== tierAfter) {
      const isUpgrade = scoreAfter > scoreBefore;
      const title = isUpgrade
        ? `Trust tier upgrade: ${tierAfter}!`
        : `Trust tier changed: ${tierAfter}`;
      const body = isUpgrade
        ? `Congratulations! You've reached ${tierAfter} status. ${TIER_PERKS[tierAfter]}`
        : `Your trust tier has changed to ${tierAfter}.`;

      await this.prisma.notification.create({
        data: { userId, title, body, channel: NotifChannel.IN_APP },
      });
    }

    this.logger.log(
      `TrustScore user ${userId}: ${pointsDelta > 0 ? '+' : ''}${pointsDelta} → ${scoreAfter} (${eventType})`,
    );
  }

  async getScoreDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { trustScore: true },
    });
    const score = user?.trustScore ?? 0;
    const tier = getTier(score);
    const maxSlotsEligible = getMaxSlotsEligible(score);

    const recentEvents = await this.prisma.trustScoreEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return { score, tier, maxSlotsEligible, recentEvents };
  }
}
