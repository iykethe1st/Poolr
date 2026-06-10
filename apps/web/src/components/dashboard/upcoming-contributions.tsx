import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency, formatRelativeDate } from '@/lib/format';
import type { ContributionWithGroup } from '@/hooks/use-dashboard';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'text-foreground',
  OVERDUE: 'text-destructive font-semibold',
};

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
            {[1, 2, 3].map((i) => (
              <ContribSkeleton key={i} />
            ))}
          </div>
        ) : !upcoming?.length ? (
          <EmptyContributions />
        ) : (
          <ul className="divide-y">
            {upcoming.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/groups/${c.cycle.group.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <span
                    className={cn(
                      'mt-0.5 size-2 shrink-0 rounded-full',
                      DUE_DOT[c.status] ?? 'bg-muted',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.cycle.group.name}</p>
                    <p
                      className={cn(
                        'text-xs',
                        STATUS_STYLES[c.status] ?? 'text-muted-foreground',
                      )}
                    >
                      {formatRelativeDate(c.dueAt)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">
                    {formatCurrency(c.amount)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
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
      <Skeleton className="h-4 w-16" />
    </div>
  );
}
