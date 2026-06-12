'use client';

import { useAdminGroups, useAdminGroupCycles } from '@/hooks/use-admin';
import { PayoutTable } from './payout-table';
import { Skeleton } from '@/components/ui/skeleton';

function GroupPayouts({ groupId, name }: { groupId: string; name: string }) {
  const { data: cycles, isLoading } = useAdminGroupCycles(groupId);

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!cycles?.length) return null;

  const hasPayouts = cycles.some((c) => c.payouts.length > 0);
  if (!hasPayouts) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{name}</h2>
      <PayoutTable cycles={cycles} />
    </div>
  );
}

export function AllPayoutsContent() {
  const { data: groups, isLoading } = useAdminGroups();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Payout history across all groups.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      )}

      {!isLoading && groups?.map((g) => (
        <GroupPayouts key={g.id} groupId={g.id} name={g.name} />
      ))}

      {!isLoading && !groups?.length && (
        <p className="rounded-xl border bg-card py-12 text-center text-sm text-muted-foreground">
          No groups found.
        </p>
      )}
    </div>
  );
}
