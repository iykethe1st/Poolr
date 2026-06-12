'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PayoutTriggerModal } from './payout-trigger-modal';
import type { AdminCycle, Contribution } from '@/hooks/use-admin';
import { formatDate, formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'muted' | 'default' }> = {
  PAID: { label: 'Paid', variant: 'success' },
  OVERDUE: { label: 'Overdue', variant: 'destructive' },
  PENDING: { label: 'Pending', variant: 'warning' },
  WAIVED: { label: 'Waived', variant: 'muted' },
};

const CYCLE_STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'default' | 'secondary' }> = {
  COMPLETED: { label: 'Completed', variant: 'success' },
  ACTIVE: { label: 'Active', variant: 'default' },
  OVERDUE: { label: 'Overdue', variant: 'destructive' },
  PENDING: { label: 'Pending', variant: 'secondary' },
};

interface ContributionMatrixProps {
  groupId: string;
  cycles: AdminCycle[];
  loading?: boolean;
}

export function ContributionMatrix({ groupId, cycles, loading }: ContributionMatrixProps) {
  const { members, matrix } = useMemo(() => buildMatrix(cycles), [cycles]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!cycles.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No cycles yet. Start the group to generate cycles.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left font-semibold">Member</th>
            {cycles.map((c) => {
              const cycleStatus = CYCLE_STATUS_BADGE[c.status] ?? { label: c.status, variant: 'secondary' as const };
              return (
                <th key={c.id} className="min-w-[130px] px-3 py-2 text-center font-medium">
                  <div className="flex flex-col items-center gap-1">
                    <span>Cycle {c.cycleNumber}</span>
                    <Badge variant={cycleStatus.variant} className="text-[10px]">
                      {cycleStatus.label}
                    </Badge>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      Due {formatDate(c.dueDate)}
                    </span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {c.recipient.fullName}
                    </span>
                    <PayoutTriggerModal
                      groupId={groupId}
                      cycle={c}
                    />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {members.map((member, idx) => (
            <tr key={member.memberId} className={cn('border-b', idx % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
              <td className="sticky left-0 z-10 bg-inherit px-4 py-3 font-medium">
                {member.memberName}
              </td>
              {cycles.map((c) => {
                const contrib = matrix[member.memberId]?.[c.id];
                if (!contrib) {
                  return (
                    <td key={c.id} className="px-3 py-3 text-center">
                      <span className="text-xs text-muted-foreground/50">—</span>
                    </td>
                  );
                }
                const cfg = STATUS_BADGE[contrib.status] ?? { label: contrib.status, variant: 'default' as const };
                return (
                  <td key={c.id} className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      {contrib.paidAt && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(contrib.paidAt)}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatCurrency(contrib.amount)}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/40">
            <td className="sticky left-0 bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground">
              Summary
            </td>
            {cycles.map((c) => (
              <td key={c.id} className="px-3 py-2 text-center">
                <div className="flex flex-col items-center gap-0.5 text-[10px] text-muted-foreground">
                  <span className="text-emerald-700">{c.summary.paid} paid</span>
                  {c.summary.overdue > 0 && (
                    <span className="text-destructive">{c.summary.overdue} overdue</span>
                  )}
                  {c.summary.pending > 0 && (
                    <span>{c.summary.pending} pending</span>
                  )}
                  {c.summary.waived > 0 && (
                    <span>{c.summary.waived} waived</span>
                  )}
                </div>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function buildMatrix(cycles: AdminCycle[]) {
  const memberMap = new Map<string, { memberId: string; memberName: string }>();
  const matrix: Record<string, Record<string, Contribution>> = {};

  for (const cycle of cycles) {
    for (const contrib of cycle.contributions) {
      if (!memberMap.has(contrib.memberId)) {
        memberMap.set(contrib.memberId, {
          memberId: contrib.memberId,
          memberName: contrib.memberName,
        });
      }
      if (!matrix[contrib.memberId]) matrix[contrib.memberId] = {};
      matrix[contrib.memberId]![cycle.id] = contrib;
    }
  }

  const members = Array.from(memberMap.values());
  return { members, matrix };
}
