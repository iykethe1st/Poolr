'use client';

import { useState } from 'react';
import { PenaltyTable } from './penalty-table';
import { useAdminPenalties, useRunPenaltyCheck } from '@/hooks/use-admin';
import { Button } from '@/components/ui/button';

export function AllPenaltiesContent() {
  const { data: penalties, isLoading } = useAdminPenalties();
  const runCheck = useRunPenaltyCheck();
  const [ran, setRan] = useState(false);

  function handleRunCheck() {
    runCheck.mutate(undefined, {
      onSuccess: () => setRan(true),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Penalties</h1>
          <p className="text-sm text-muted-foreground">
            All applied penalties across all groups.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunCheck}
            disabled={runCheck.isPending}
          >
            {runCheck.isPending ? 'Running…' : 'Run missed-payment check'}
          </Button>
          {ran && !runCheck.isPending && (
            <p className="text-xs text-muted-foreground">
              Check complete — penalties applied for any overdue contributions.
            </p>
          )}
          {runCheck.isError && (
            <p className="text-xs text-destructive">Failed to run check.</p>
          )}
        </div>
      </div>
      <PenaltyTable penalties={penalties ?? []} loading={isLoading} />
    </div>
  );
}
