'use client';

import { useState } from 'react';
import { HTTPError } from 'ky';
import { AlertTriangle, Loader2, Play } from 'lucide-react';
import type { ApiResponse } from '@poolr/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStartGroup, type GroupDetail } from '@/hooks/use-group';
import { formatCurrency, formatFrequency } from '@/lib/format';

interface StartGroupModalProps {
  group: GroupDetail;
}

export function StartGroupModal({ group }: StartGroupModalProps) {
  const [open, setOpen] = useState(false);
  const { mutateAsync, isPending } = useStartGroup(group.id);
  const [error, setError] = useState('');

  const activeMembers = group.members.filter((m) => m.memberStatus === 'ACTIVE');
  const canStart = activeMembers.length >= 2 && !!group.startDate;

  async function handleStart() {
    setError('');
    try {
      await mutateAsync();
      setOpen(false);
    } catch (err) {
      if (err instanceof HTTPError) {
        const body = await err.response.json<ApiResponse>();
        const msg = body.message ?? 'Failed to start group.';
        setError(Array.isArray(msg) ? msg[0] : msg);
      } else {
        setError('Failed to start group. Please try again.');
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={!canStart} title={!canStart ? 'Need at least 2 active members and a start date' : undefined}>
          <Play className="size-3.5" />
          Start group
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start &ldquo;{group.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            This will lock the rotation order and generate{' '}
            <strong>{activeMembers.length} cycles</strong>. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-sm">
          <Row label="Members" value={`${activeMembers.length} active`} />
          <Row label="Amount per cycle" value={formatCurrency(group.contributionAmount, group.currency)} />
          <Row label="Frequency" value={formatFrequency(group.frequency)} />
          <Row
            label="First cycle due"
            value={
              group.startDate
                ? new Date(group.startDate).toLocaleDateString('en-NG', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'
            }
          />
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Once started, the rotation order is locked. Members in <em>INVITED</em> status
            will not be included.
          </span>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Starting…
              </>
            ) : (
              'Yes, start group'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
