"use client";

import Link from "next/link";
import { AlertTriangle, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-shell";
import { GroupsList } from "./groups-list";
import { UpcomingContributions } from "./upcoming-contributions";
import { RecentActivity } from "./recent-activity";
import { NextPayoutCard, TotalContributedCard } from "./summary-cards";
import {
  useCurrentUser,
  useGroups,
  useContributions,
  useNotifications,
} from "@/hooks/use-dashboard";
import { useMyPayouts, useNextPayout } from "@/hooks/use-payments";
import { formatCurrency } from "@/lib/format";

export function DashboardContent() {
  const { data: user } = useCurrentUser();
  const { data: groups, isLoading: groupsLoading } = useGroups();
  const { data: contributions, isLoading: contribLoading } = useContributions();
  const { data: notifications, isLoading: notifLoading } = useNotifications();
  const { data: payouts } = useMyPayouts();
  const { data: nextPayout, isLoading: nextPayoutLoading } = useNextPayout();

  const pendingPayouts = payouts?.filter((p) => p.status === "PENDING") ?? [];

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
        {!kycVerified && user && (
          <Button size="sm" variant="outline" asChild>
            <Link href="/kyc">
              <ShieldCheck className="size-3.5" />
              Identity verification
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* ── Pending payout banner ───────────────────────────────────────────── */}
      {pendingPayouts.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <CreditCard className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-amber-800">
              {pendingPayouts.length === 1
                ? `You have a payout of ${formatCurrency(pendingPayouts[0]!.amount, "NGN")} waiting from "${pendingPayouts[0]!.cycle.group.name}"`
                : `You have ${pendingPayouts.length} payouts waiting`}
            </span>
            <span className="text-amber-700">
              {" "}— add your bank account to receive{" "}
              {pendingPayouts.length === 1 ? "it" : "them"}.
            </span>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100" asChild>
            <Link href="/settings">Add bank account</Link>
          </Button>
        </div>
      )}

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
      <div className="grid gap-4 sm:grid-cols-2">
        <NextPayoutCard payout={nextPayout} loading={nextPayoutLoading} />
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
