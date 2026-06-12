import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminCycle, Payout } from '@/hooks/use-admin';
import { formatCurrency, formatDate } from '@/lib/utils';

const PAYOUT_STATUS: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' | 'default' }> = {
  COMPLETED: { label: 'Completed', variant: 'success' },
  INITIATED: { label: 'Initiated', variant: 'warning' },
  FAILED: { label: 'Failed', variant: 'destructive' },
  PENDING: { label: 'Pending', variant: 'secondary' },
};

interface PayoutTableProps {
  cycles: AdminCycle[];
  loading?: boolean;
}

export function PayoutTable({ cycles, loading }: PayoutTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  type Row = { cycle: AdminCycle; payout: Payout | null };
  const rows: Row[] = cycles.flatMap((c) =>
    c.payouts.length > 0
      ? c.payouts.map((p): Row => ({ cycle: c, payout: p }))
      : [{ cycle: c, payout: null } satisfies Row],
  );

  if (!rows.length) {
    return (
      <div className="rounded-xl border bg-card py-12 text-center">
        <p className="font-medium text-muted-foreground">No payout records</p>
        <p className="mt-1 text-sm text-muted-foreground/70">Payouts will appear here once cycles are completed.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-3 text-left font-semibold">Cycle</th>
            <th className="px-4 py-3 text-left font-semibold">Recipient</th>
            <th className="px-4 py-3 text-right font-semibold">Amount</th>
            <th className="px-4 py-3 text-left font-semibold">Status</th>
            <th className="px-4 py-3 text-left font-semibold">Completed</th>
            <th className="px-4 py-3 text-left font-semibold">Reference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ cycle, payout }) => {
            const cfg = payout ? (PAYOUT_STATUS[payout.status] ?? { label: payout.status, variant: 'default' as const }) : null;
            return (
              <tr key={`${cycle.id}-${payout?.id ?? 'no-payout'}`} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">Cycle {cycle.cycleNumber}</td>
                <td className="px-4 py-3">{cycle.recipient.fullName}</td>
                <td className="px-4 py-3 text-right">
                  {payout ? formatCurrency(payout.amount) : '—'}
                </td>
                <td className="px-4 py-3">
                  {cfg ? (
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  ) : (
                    <Badge variant="secondary">No payout</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {payout?.completedAt ? formatDate(payout.completedAt) : '—'}
                </td>
                <td className="px-4 py-3">
                  {payout?.reference ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {payout.reference}
                    </span>
                  ) : payout?.transferCode ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {payout.transferCode}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
