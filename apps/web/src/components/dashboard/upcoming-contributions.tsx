'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, Loader2 } from 'lucide-react';
import { HTTPError } from 'ky';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency, formatRelativeDate } from '@/lib/format';
import { useInitializeContribution } from '@/hooks/use-payments';
import type { ContributionWithGroup } from '@/hooks/use-dashboard';

const DUE_DOT: Record<string, string> = {
  PENDING: 'bg-amber-400',
  OVERDUE: 'bg-destructive',
};

interface UpcomingContributionsProps {
  contributions: ContributionWithGroup[] | undefined;
  loading: boolean;
}

export function UpcomingContributions({ contributions, loading }: UpcomingContributionsProps) {
  const upcoming = contributions
    ?.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE')
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 6);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Upcoming payments</h3>
        {!loading && upcoming && upcoming.length > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
            {upcoming.length}
          </span>
        )}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        {loading ? (
          <div className="divide-y">
            {[1, 2, 3].map((i) => <ContribSkeleton key={i} />)}
          </div>
        ) : !upcoming?.length ? (
          <EmptyContributions />
        ) : (
          <ul className="divide-y">
            {upcoming.map((c) => (
              <ContribRow key={c.id} contribution={c} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ContribRow({ contribution: c }: { contribution: ContributionWithGroup }) {
  const router = useRouter();
  const { mutateAsync, isPending } = useInitializeContribution();
  const [error, setError] = useState('');

  async function handlePayNow() {
    setError('');
    try {
      const { authorizationUrl, reference } = await mutateAsync(c.cycleId);

      if (authorizationUrl.includes('dev_mock')) {
        // Dev mode: skip Paystack and go straight to callback
        router.push(`/payments/callback?reference=${reference}`);
      } else {
        window.location.href = authorizationUrl;
      }
    } catch (err) {
      if (err instanceof HTTPError) {
        const body = await err.response.json<{ message?: string }>();
        setError(body.message ?? 'Payment failed.');
      } else {
        setError('Could not start payment.');
      }
    }
  }

  const isOverdue = c.status === 'OVERDUE';

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'mt-0.5 size-2 shrink-0 rounded-full',
            DUE_DOT[c.status] ?? 'bg-muted',
          )}
        />
        <div className="min-w-0 flex-1">
          <Link
            href={`/groups/${c.cycle.group.id}`}
            className="truncate text-sm font-medium hover:underline"
          >
            {c.cycle.group.name}
          </Link>
          <p
            className={cn(
              'text-xs',
              isOverdue ? 'font-semibold text-destructive' : 'text-muted-foreground',
            )}
          >
            {formatRelativeDate(c.dueAt)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <p className="text-sm font-semibold">{formatCurrency(c.amount)}</p>
          <Button
            size="sm"
            variant={isOverdue ? 'destructive' : 'default'}
            className="h-7 px-2.5 text-xs"
            onClick={handlePayNow}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="size-3 animate-spin" /> : 'Pay now'}
          </Button>
        </div>
      </div>
      {error && <p className="mt-1 pl-5 text-xs text-destructive">{error}</p>}
    </li>
  );
}

function EmptyContributions() {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <CalendarClock className="size-8 text-muted-foreground/50" />
      <p className="text-sm font-medium">All caught up!</p>
      <p className="text-xs text-muted-foreground">No upcoming payments.</p>
    </div>
  );
}

function ContribSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="size-2 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-7 w-20" />
    </div>
  );
}
