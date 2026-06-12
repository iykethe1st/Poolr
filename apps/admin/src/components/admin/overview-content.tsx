'use client';

import Link from 'next/link';
import { Users, CircleDollarSign, Activity, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminGroups, useAdminPenalties } from '@/hooks/use-admin';
import { formatCurrency, formatDate } from '@/lib/utils';

function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ElementType;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className="mt-3 text-2xl font-bold">{value}</p>
      )}
      {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
    </div>
  );
}

export function OverviewContent() {
  const { data: groups, isLoading: groupsLoading } = useAdminGroups();
  const { data: penalties, isLoading: penaltiesLoading } = useAdminPenalties();

  const activeGroups = groups?.filter((g) => g.status === 'ACTIVE').length ?? 0;
  const totalPooled = groups?.reduce((sum, g) => sum + (g.stats.totalCollectedNgn ?? 0), 0) ?? 0;
  const activeCycles = groups?.reduce((sum, g) => sum + g.stats.totalCycles, 0) ?? 0;
  const pendingPenalties = penalties?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground">Platform-wide snapshot.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active groups"
          value={groupsLoading ? '—' : String(activeGroups)}
          subtext={`${groups?.length ?? 0} total groups`}
          icon={Users}
          loading={groupsLoading}
        />
        <StatCard
          label="Total pooled"
          value={groupsLoading ? '—' : formatCurrency(totalPooled)}
          subtext="All-time contributions"
          icon={CircleDollarSign}
          loading={groupsLoading}
        />
        <StatCard
          label="Total cycles"
          value={groupsLoading ? '—' : String(activeCycles)}
          subtext="Across all groups"
          icon={Activity}
          loading={groupsLoading}
        />
        <StatCard
          label="Pending penalties"
          value={penaltiesLoading ? '—' : String(pendingPenalties)}
          subtext="Requires action"
          icon={AlertTriangle}
          loading={penaltiesLoading}
        />
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold">All groups</h2>
        <GroupsTable groups={groups ?? []} loading={groupsLoading} />
      </div>
    </div>
  );
}

function GroupsTable({
  groups,
  loading,
}: {
  groups: import('@/hooks/use-admin').AdminGroup[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (!groups.length) {
    return (
      <p className="rounded-xl border bg-card py-10 text-center text-sm text-muted-foreground">
        No groups yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-3 text-left font-semibold">Name</th>
            <th className="px-4 py-3 text-left font-semibold">Admin</th>
            <th className="px-4 py-3 text-left font-semibold">Status</th>
            <th className="px-4 py-3 text-right font-semibold">Members</th>
            <th className="px-4 py-3 text-right font-semibold">Cycles</th>
            <th className="px-4 py-3 text-right font-semibold">Collected</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.id} className="border-b last:border-0 hover:bg-muted/20">
              <td className="px-4 py-3">
                <Link href={`/groups/${g.id}`} className="font-medium hover:underline">
                  {g.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{g.admin.fullName}</td>
              <td className="px-4 py-3">
                <GroupStatusBadge status={g.status} />
              </td>
              <td className="px-4 py-3 text-right">{g.stats.totalMembers}</td>
              <td className="px-4 py-3 text-right">{g.stats.totalCycles}</td>
              <td className="px-4 py-3 text-right font-medium">
                {formatCurrency(g.stats.totalCollectedNgn)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupStatusBadge({ status }: { status: string }) {
  const map: Record<string, 'success' | 'default' | 'secondary' | 'muted' | 'destructive'> = {
    ACTIVE: 'success',
    DRAFT: 'secondary',
    PAUSED: 'warning' as 'muted',
    COMPLETED: 'muted',
    CANCELLED: 'destructive',
  };
  return <Badge variant={map[status] ?? 'default'}>{status}</Badge>;
}
