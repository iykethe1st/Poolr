'use client';

import Link from 'next/link';
import { ArrowLeft, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ContributionMatrix } from './contribution-matrix';
import { useAdminGroups, useAdminGroupCycles } from '@/hooks/use-admin';
import { formatCurrency } from '@/lib/utils';

interface GroupDetailContentProps {
  groupId: string;
}

export function GroupDetailContent({ groupId }: GroupDetailContentProps) {
  const { data: groups, isLoading: groupsLoading } = useAdminGroups();
  const { data: cycles, isLoading: cyclesLoading } = useAdminGroupCycles(groupId);

  const group = groups?.find((g) => g.id === groupId);

  if (groupsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="py-16 text-center">
        <p className="font-medium text-muted-foreground">Group not found</p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href="/groups">Back to groups</Link>
        </Button>
      </div>
    );
  }

  const overdueCount = cycles?.reduce((sum, c) => sum + c.summary.overdue, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/groups">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <Badge variant={group.status === 'ACTIVE' ? 'success' : 'secondary'}>
              {group.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Admin: {group.admin.fullName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/groups/${groupId}/penalties`}>
              <AlertTriangle className="size-3.5" />
              Penalties
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/groups/${groupId}/payouts`}>
              <ArrowUpRight className="size-3.5" />
              Payouts
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <InfoCard label="Contribution" value={formatCurrency(group.contributionAmount)} />
        <InfoCard label="Frequency" value={group.frequency} />
        <InfoCard label="Members" value={`${group.stats.totalMembers} / ${group.maxMembers}`} />
        <InfoCard label="Total collected" value={formatCurrency(group.stats.totalCollectedNgn)} />
      </div>

      {overdueCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span className="text-destructive font-medium">{overdueCount} overdue contribution(s)</span>
          <span className="text-muted-foreground">across all cycles</span>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-base font-semibold">Contribution matrix</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Rows are members, columns are cycles. Click "Payout" in a cycle header to trigger a transfer.
        </p>
        <ContributionMatrix
          groupId={groupId}
          cycles={cycles ?? []}
          loading={cyclesLoading}
        />
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
