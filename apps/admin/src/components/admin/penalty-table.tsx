'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWaivePenalty, type Penalty } from '@/hooks/use-admin';
import { formatCurrency, formatDate } from '@/lib/utils';

const REASON_LABEL: Record<string, string> = {
  LATE_PAYMENT: 'Late payment',
  MISSED_PAYMENT: 'Missed payment',
  INSUFFICIENT_FUNDS: 'Insufficient funds',
};

interface PenaltyTableProps {
  penalties: Penalty[];
  loading?: boolean;
}

export function PenaltyTable({ penalties, loading }: PenaltyTableProps) {
  const waive = useWaivePenalty();
  const [waiving, setWaiving] = useState<Penalty | null>(null);
  const [waiveReason, setWaiveReason] = useState('');

  function handleConfirmWaive() {
    if (!waiving) return;
    waive.mutate(
      { penaltyId: waiving.id, reason: waiveReason || undefined },
      { onSuccess: () => { setWaiving(null); setWaiveReason(''); } },
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (!penalties.length) {
    return (
      <div className="rounded-xl border bg-card py-12 text-center">
        <p className="font-medium text-muted-foreground">No penalties found</p>
        <p className="mt-1 text-sm text-muted-foreground/70">All members are in good standing.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left font-semibold">Member</th>
              <th className="px-4 py-3 text-left font-semibold">Group</th>
              <th className="px-4 py-3 text-left font-semibold">Reason</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
              <th className="px-4 py-3 text-left font-semibold">Applied</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {penalties.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-4 py-3">
                  <p className="font-medium">{p.member.user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{p.member.user.email}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.member.group.name}</td>
                <td className="px-4 py-3">{REASON_LABEL[p.reason] ?? p.reason}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatCurrency(p.penaltyAmount)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(p.appliedAt)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {p.status === 'APPLIED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWaiving(p)}
                    >
                      Waive
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!waiving} onOpenChange={(o) => !o && setWaiving(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Waive penalty</DialogTitle>
            <DialogDescription>
              Waive the {formatCurrency(waiving?.penaltyAmount ?? 0)} penalty for{' '}
              {waiving?.member.user.fullName}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">Reason (optional)</label>
            <textarea
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={3}
              placeholder="Reason for waiving…"
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
            />
          </div>

          {waive.isError && (
            <p className="text-sm text-destructive">Failed to waive penalty.</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setWaiving(null)} disabled={waive.isPending}>
              Cancel
            </Button>
            <Button onClick={handleConfirmWaive} disabled={waive.isPending}>
              {waive.isPending && <Loader2 className="size-4 animate-spin" />}
              Confirm waive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'destructive' | 'muted' | 'default'> = {
    APPLIED: 'destructive',
    WAIVED: 'muted',
    PENDING: 'default',
  };
  return <Badge variant={map[status] ?? 'default'}>{status}</Badge>;
}
