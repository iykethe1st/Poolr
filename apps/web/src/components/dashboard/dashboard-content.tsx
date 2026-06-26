"use client";

import Link from "next/link";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-shell";
import { GroupsList } from "./groups-list";
import { UpcomingContributions } from "./upcoming-contributions";
import { RecentActivity } from "./recent-activity";
import { NextPayoutCard, TotalContributedCard } from "./summary-cards";
import { WalletBalanceCard } from "./wallet-card";
import {
  useCurrentUser,
  useGroups,
  useContributions,
  useNotifications,
} from "@/hooks/use-dashboard";
import { useNextPayout } from "@/hooks/use-payments";

export function DashboardContent() {
  const { data: user } = useCurrentUser();
  const { data: groups, isLoading: groupsLoading } = useGroups();
  const { data: contributions, isLoading: contribLoading } = useContributions();
  const { data: notifications, isLoading: notifLoading } = useNotifications();
  const { data: nextPayout, isLoading: nextPayoutLoading } = useNextPayout();

  const paidContributions = contributions?.filter((c) => c.status === "PAID") ?? [];
  const totalContributed = paidContributions.reduce((sum, c) => sum + Number(c.amount), 0);

  const greeting = user
    ? `Welcome back, ${user.fullName.split(" ")[0]}!`
    : "Welcome back!";

  const overdueCount =
    contributions?.filter((c) => c.status === "OVERDUE").length ?? 0;

  const kycVerified = user?.kycProfile?.kycStatus === "VERIFIED";

  return (
    <div className="space-y-6">
      <PageHeader
        title={greeting}
        description="Here's an overview of your savings."
      >
        {user?.contributionStats && user.contributionStats.tier !== 'NEW' && (
          <span className={[
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold',
            user.contributionStats.tier === 'PLATINUM' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400' :
            user.contributionStats.tier === 'GOLD'     ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-400' :
            user.contributionStats.tier === 'SILVER'   ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' :
                                                          'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
          ].join(' ')}>
            {user.contributionStats.tier === 'PLATINUM' ? '💎' : user.contributionStats.tier === 'GOLD' ? '🥇' : user.contributionStats.tier === 'SILVER' ? '🥈' : '🥉'}
            {user.contributionStats.tier.charAt(0) + user.contributionStats.tier.slice(1).toLowerCase()} member
          </span>
        )}
        {!kycVerified && user && (
          <Button size="sm" variant="outline" asChild>
            <Link href="/kyc">
              <ShieldCheck className="size-3.5" />
              Identity verification
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* ── Overdue banner ──────────────────────────────────────────────────── */}
      {!contribLoading && overdueCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-destructive">
              {overdueCount} overdue{" "}
              {overdueCount === 1 ? "payment" : "payments"}
            </span>
            <span className="text-muted-foreground">
              {" "}
              — pay now to avoid penalties.
            </span>
          </div>
        </div>
      )}

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NextPayoutCard payout={nextPayout} loading={nextPayoutLoading} />
        <WalletBalanceCard />
        <TotalContributedCard
          totalNgn={totalContributed}
          count={paidContributions.length}
          loading={contribLoading}
        />
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GroupsList
            groups={groups}
            contributions={contributions ?? []}
            userId={user?.id}
            loading={groupsLoading}
          />
        </div>
        <div>
          <UpcomingContributions
            contributions={contributions}
            loading={contribLoading}
          />
        </div>
      </div>

      {/* ── Activity feed ───────────────────────────────────────────────────── */}
      <RecentActivity notifications={notifications} loading={notifLoading} />
    </div>
  );
}
