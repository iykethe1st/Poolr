'use client';

import { useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useTriggerPayout, type AdminCycle } from '@/hooks/use-admin';
import { formatCurrency, formatDate } from '@/lib/utils';

interface PayoutTriggerModalProps {
  groupId: string;
  cycle: AdminCycle;
}

export function PayoutTriggerModal({ groupId, cycle }: PayoutTriggerModalProps) {
  const [open, setOpen] = useState(false);
  const trigger = useTriggerPayout();

  const existingPayout = cycle.payouts[0];
  const alreadyTriggered =
    existingPayout &&
    ['INITIATED', 'COMPLETED'].includes(existingPayout.status);

  function handleTrigger() {
    trigger.mutate(
      { groupId, cycleId: cycle.id },
      {
        onSuccess: () => setOpen(false),
      },
    );
  }

  if (alreadyTriggered) {
    const variant =
      existingPayout.status === 'COMPLETED'
        ? ('success' as const)
        : ('warning' as const);
    return <Badge variant={variant} className="text-[10px]">{existingPayout.status}</Badge>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-6 gap-1 px-2 text-[10px]"
          disabled={cycle.status === 'PENDING' || cycle.summary.paid === 0}
        >
          <Zap className="size-3" />
          Payout
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Trigger payout — Cycle {cycle.cycleNumber}</DialogTitle>
          <DialogDescription>
            This will enqueue a Paystack transfer to the cycle recipient. The action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/30 p-4 text-sm space-y-2">
          <Row label="Recipient" value={cycle.recipient.fullName} />
          <Row label="Due date" value={formatDate(cycle.dueDate)} />
          <Row
            label="Contributions"
            value={`${cycle.summary.paid} / ${cycle.summary.total} paid`}
          />
          {cycle.payouts[0] && (
            <Row
              label="Payout amount"
              value={formatCurrency(cycle.payouts[0].amount)}
            />
          )}
          {cycle.summary.overdue > 0 && (
            <p className="text-xs text-destructive">
              {cycle.summary.overdue} overdue contribution(s) — payout will still proceed.
            </p>
          )}
        </div>

        {trigger.isError && (
          <p className="text-sm text-destructive">Failed to trigger payout. Try again.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={trigger.isPending}>
            Cancel
          </Button>
          <Button onClick={handleTrigger} disabled={trigger.isPending}>
            {trigger.isPending && <Loader2 className="size-4 animate-spin" />}
            Confirm payout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
