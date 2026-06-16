'use client';

import { Banknote, TrendingUp } from 'lucide-react';
import { formatCurrency, formatRelativeDate } from '@/lib/format';
import type { NextPayout } from '@/hooks/use-payments';

export function NextPayoutCard({
  payout,
  loading,
}: {
  payout: NextPayout | null | undefined;
  loading: boolean;
}) {
  if (loading) return <SummaryCardSkeleton />;

  return (
    <div className="rounded-xl border bg-card px-4 py-4 space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Banknote className="size-3.5" />
        Your next payout
      </div>
      {payout ? (
        <>
          <p className="text-2xl font-bold tracking-tight text-primary">
            {formatCurrency(payout.amountNgn, 'NGN')}
          </p>
          <p className="text-xs text-muted-foreground">
            {payout.groupName} &middot; Cycle {payout.cycleNumber}
          </p>
          <p className="text-xs text-muted-foreground">
            {payout.isActive ? 'Collection in progress' : formatRelativeDate(payout.dueDate)}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground py-1">No upcoming payout</p>
      )}
    </div>
  );
}

export function TotalContributedCard({
  totalNgn,
  count,
  loading,
}: {
  totalNgn: number;
  count: number;
  loading: boolean;
}) {
  if (loading) return <SummaryCardSkeleton />;

  return (
    <div className="rounded-xl border bg-card px-4 py-4 space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <TrendingUp className="size-3.5" />
        Total contributed
      </div>
      <p className="text-2xl font-bold tracking-tight">
        {formatCurrency(totalNgn, 'NGN')}
      </p>
      <p className="text-xs text-muted-foreground">
        {count > 0
          ? `Across ${count} payment${count !== 1 ? 's' : ''}`
          : 'No payments yet'}
      </p>
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card px-4 py-4 space-y-2 animate-pulse">
      <div className="h-3 w-28 rounded bg-muted" />
      <div className="h-7 w-36 rounded bg-muted" />
      <div className="h-3 w-24 rounded bg-muted" />
    </div>
  );
}
