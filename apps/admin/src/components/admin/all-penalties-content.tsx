'use client';

import { PenaltyTable } from './penalty-table';
import { useAdminPenalties } from '@/hooks/use-admin';

export function AllPenaltiesContent() {
  const { data: penalties, isLoading } = useAdminPenalties();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Penalties</h1>
        <p className="text-sm text-muted-foreground">
          All applied penalties across all groups.
        </p>
      </div>
      <PenaltyTable penalties={penalties ?? []} loading={isLoading} />
    </div>
  );
}
