import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class FeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Returns the flat platform fee (NGN) for a given contribution amount.
   * Thresholds and amounts are read from env so they can be changed without a deploy.
   */
  calculateFee(contributionAmountNgn: number): number {
    const n = (key: string, def: number) =>
      Number(this.config.get(key, String(def)));

    const tier1Max = n("CONTRIBUTION_FEE_TIER_1_MAX", 10_000);
    const tier1Fee = n("CONTRIBUTION_FEE_TIER_1_AMOUNT", 0);
    const tier2Max = n("CONTRIBUTION_FEE_TIER_2_MAX", 50_000);
    const tier2Fee = n("CONTRIBUTION_FEE_TIER_2_AMOUNT", 0);
    const tier3Fee = n("CONTRIBUTION_FEE_TIER_3_AMOUNT", 1_800);

    if (contributionAmountNgn <= tier1Max) return tier1Fee;
    if (contributionAmountNgn <= tier2Max) return tier2Fee;
    return tier3Fee;
  }

  /**
   * Records the fee for a paid contribution.
   * Must be called inside a Prisma transaction atomically with marking the contribution PAID.
   * The UNIQUE constraint on contributionId ensures idempotency — a second call for the same
   * contribution is a no-op (silent return after detecting the existing record).
   */
  async collectFee(
    contributionId: string,
    userId: string,
    contributionAmountNgn: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const existing = await tx.contributionFee.findUnique({
      where: { contributionId },
    });
    if (existing) return;

    const feeAmount = this.calculateFee(contributionAmountNgn);
    const reservePct = Number(
      this.config.get("RESERVE_CONTRIBUTION_PERCENTAGE", "0.2"),
    );
    const reserveAmount = Math.round(feeAmount * reservePct * 100) / 100;
    const revenueAmount = Math.round((feeAmount - reserveAmount) * 100) / 100;

    await tx.contributionFee.create({
      data: {
        contributionId,
        userId,
        contributionAmount: contributionAmountNgn,
        feeAmount,
        reserveAmount,
        revenueAmount,
      },
    });

    await tx.contribution.update({
      where: { id: contributionId },
      data: {
        feeAmount,
        totalCharged: contributionAmountNgn + feeAmount,
      },
    });
  }

  async getFeeSummary(filters?: {
    startDate?: Date;
    endDate?: Date;
    groupId?: string;
  }) {
    const where: Prisma.ContributionFeeWhereInput = {};

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {}),
      };
    }

    if (filters?.groupId) {
      where.contribution = { cycle: { groupId: filters.groupId } };
    }

    const [totals, records] = await Promise.all([
      this.prisma.contributionFee.aggregate({
        where,
        _sum: { feeAmount: true, reserveAmount: true, revenueAmount: true },
        _count: { id: true },
      }),
      this.prisma.contributionFee.findMany({
        where,
        include: {
          contribution: {
            include: {
              cycle: {
                select: {
                  cycleNumber: true,
                  group: { select: { id: true, name: true } },
                },
              },
            },
          },
          user: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return {
      totalFeesCollectedNgn: Number(totals._sum.feeAmount ?? 0),
      totalReserveNgn: Number(totals._sum.reserveAmount ?? 0),
      totalRevenueNgn: Number(totals._sum.revenueAmount ?? 0),
      transactionCount: totals._count.id,
      records,
    };
  }

  async getFeeById(id: string) {
    return this.prisma.contributionFee.findUniqueOrThrow({
      where: { id },
      include: {
        contribution: {
          include: {
            cycle: {
              select: {
                cycleNumber: true,
                group: { select: { id: true, name: true } },
              },
            },
          },
        },
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
  }
}
