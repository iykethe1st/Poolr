'use client';

import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import type { Cycle, GroupMember } from '@/hooks/use-group';

interface CycleTimelineProps {
  cycles: Cycle[];
  members: GroupMember[];
  contributionAmount: number;
  currency: string;
}

const STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; badge: 'success' | 'warning' | 'outline' | 'destructive'; label: string }
> = {
  COMPLETED: { icon: CheckCircle2, color: 'text-emerald-500', badge: 'success', label: 'Completed' },
  ACTIVE: { icon: Clock, color: 'text-amber-500', badge: 'warning', label: 'Active' },
  OVERDUE: { icon: AlertCircle, color: 'text-destructive', badge: 'destructive', label: 'Overdue' },
  PENDING: { icon: Circle, color: 'text-muted-foreground/40', badge: 'outline', label: 'Pending' },
};

export function CycleTimeline({ cycles, members, contributionAmount, currency }: CycleTimelineProps) {
  const sortedCycles = [...cycles].sort((a, b) => a.cycleNumber - b.cycleNumber);

  const memberMap = new Map(members.map((m) => [m.userId, m.user.fullName]));

  return (
    <div className="space-y-0">
      {sortedCycles.map((cycle, i) => {
        const { icon: Icon, color, badge, label } = STATUS_CONFIG[cycle.status] ?? STATUS_CONFIG.PENDING;
        const recipientName = memberMap.get(cycle.recipientId) ?? 'Unknown';
        const isLast = i === sortedCycles.length - 1;

        return (
          <div key={cycle.id} className="relative flex gap-4">
            {/* Connector line */}
            {!isLast && (
              <div className="absolute left-[18px] top-9 bottom-0 w-px bg-border" />
            )}

            {/* Icon */}
            <div className="relative z-10 mt-4 shrink-0">
              <Icon className={cn('size-5', color)} />
            </div>

            {/* Content */}
            <div className="flex-1 rounded-xl border bg-card px-4 py-3 mb-2 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Cycle {cycle.cycleNumber}
                    </span>
                    <Badge variant={badge}>{label}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm font-medium">{recipientName}</p>
                  <p className="text-xs text-muted-foreground">
                    Due:{' '}
                    {new Date(cycle.dueDate).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  {cycle.payoutDate && (
                    <p className="text-xs text-muted-foreground">
                      Paid out:{' '}
                      {new Date(cycle.payoutDate).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>

                <p className="shrink-0 text-sm font-semibold">
                  {formatCurrency(contributionAmount * members.filter((m) => m.memberStatus === 'ACTIVE').length, currency)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
