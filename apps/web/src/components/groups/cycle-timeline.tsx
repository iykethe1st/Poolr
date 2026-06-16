'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HTTPError } from 'ky';
import { CheckCircle2, Circle, Clock, AlertCircle, CreditCard, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { useInitializeContribution } from '@/hooks/use-payments';
import type { Cycle, GroupMember } from '@/hooks/use-group';

interface CycleTimelineProps {
  cycles: Cycle[];
  members: GroupMember[];
  contributionAmount: number;
  currency: string;
  currentUserId?: string;
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

export function CycleTimeline({ cycles, members, contributionAmount, currency, currentUserId }: CycleTimelineProps) {
  const sortedCycles = [...cycles].sort((a, b) => a.cycleNumber - b.cycleNumber);

  const memberMap = new Map(members.map((m) => [m.userId, m.user.fullName]));
  const myMember = members.find((m) => m.userId === currentUserId);
  const isActiveMember = myMember?.memberStatus === 'ACTIVE';

  return (
    <div className="space-y-0">
      {sortedCycles.map((cycle, i) => {
        const { icon: Icon, color, badge, label } = STATUS_CONFIG[cycle.status] ?? STATUS_CONFIG.PENDING;
        const recipientName = memberMap.get(cycle.recipientId) ?? 'Unknown';
        const isLast = i === sortedCycles.length - 1;
        const isPayable = (cycle.status === 'ACTIVE' || cycle.status === 'OVERDUE') && isActiveMember;
        const isMyReceivingCycle = cycle.recipientId === currentUserId;

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
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Cycle {cycle.cycleNumber}
                    </span>
                    <Badge variant={badge}>{label}</Badge>
                    {isMyReceivingCycle && (cycle.status === 'ACTIVE' || cycle.status === 'PENDING') && (
                      <Badge variant="default" className="text-xs">Receiving</Badge>
                    )}
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

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className="text-sm font-semibold">
                    {formatCurrency(contributionAmount * members.filter((m) => m.memberStatus === 'ACTIVE').length, currency)}
                  </p>
                  {isPayable && (
                    <PayButton cycleId={cycle.id} currency={currency} contributionAmount={contributionAmount} />
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PayButton({
  cycleId,
  currency,
  contributionAmount,
}: {
  cycleId: string;
  currency: string;
  contributionAmount: number;
}) {
  const router = useRouter();
  const init = useInitializeContribution();
  const [paid, setPaid] = useState(false);

  if (paid) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
        <CheckCircle2 className="size-3.5" />
        Paid
      </span>
    );
  }

  function handlePay() {
    init.mutate(cycleId, {
      onSuccess: ({ authorizationUrl }) => {
        if (process.env.NODE_ENV === 'development' && !authorizationUrl.startsWith('https://checkout.paystack')) {
          router.push('/payments/callback?reference=dev_test');
        } else {
          window.location.href = authorizationUrl;
        }
      },
      onError: async (err) => {
        if (err instanceof HTTPError) {
          const body: { message?: string } = await err.response.json().catch(() => ({}));
          if (body.message?.toLowerCase().includes('already paid')) {
            setPaid(true);
            return;
          }
        }
      },
    });
  }

  return (
    <Button size="sm" className="h-7 px-3 text-xs" onClick={handlePay} disabled={init.isPending}>
      {init.isPending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <CreditCard className="size-3" />
      )}
      Pay {formatCurrency(contributionAmount, currency)}
    </Button>
  );
}
