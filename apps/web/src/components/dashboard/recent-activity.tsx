import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownLeft,
  Banknote,
  CircleDollarSign,
  Clock,
  Landmark,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/format';
import type { NotificationsResult } from '@/hooks/use-dashboard';

interface RecentActivityProps {
  notifications: NotificationsResult | undefined;
  loading: boolean;
}

type ActivityIconConfig = {
  icon: React.ElementType;
  bg: string;
  fg: string;
};

function getActivityIcon(title: string): ActivityIconConfig {
  const t = title.toLowerCase();
  if (t.includes('payout') && (t.includes('fail') || t.includes('urgent') || t.includes('action')))
    return { icon: AlertTriangle, bg: 'bg-red-100 dark:bg-red-950/50', fg: 'text-red-600 dark:text-red-400' };
  if (t.includes('payout'))
    return { icon: Banknote, bg: 'bg-green-100 dark:bg-green-950/50', fg: 'text-green-700 dark:text-green-400' };
  if (t.includes('penalty'))
    return { icon: AlertTriangle, bg: 'bg-orange-100 dark:bg-orange-950/50', fg: 'text-orange-600 dark:text-orange-400' };
  if (t.includes('contribution') && t.includes('due'))
    return { icon: Clock, bg: 'bg-amber-100 dark:bg-amber-950/50', fg: 'text-amber-700 dark:text-amber-400' };
  if (t.includes('contribution') || t.includes('payment'))
    return { icon: CircleDollarSign, bg: 'bg-blue-100 dark:bg-blue-950/50', fg: 'text-blue-700 dark:text-blue-400' };
  if (t.includes('joined') || t.includes('member'))
    return { icon: UserPlus, bg: 'bg-purple-100 dark:bg-purple-950/50', fg: 'text-purple-700 dark:text-purple-400' };
  if (t.includes('bank account') || t.includes('withdrawal account'))
    return { icon: Landmark, bg: 'bg-slate-100 dark:bg-slate-800', fg: 'text-slate-600 dark:text-slate-400' };
  if (t.includes('top') || t.includes('wallet'))
    return { icon: ArrowDownLeft, bg: 'bg-emerald-100 dark:bg-emerald-950/50', fg: 'text-emerald-700 dark:text-emerald-400' };
  return { icon: Sparkles, bg: 'bg-muted', fg: 'text-muted-foreground' };
}

export function RecentActivity({ notifications, loading }: RecentActivityProps) {
  const items = notifications?.items ?? [];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Recent activity</h3>
        {!loading && (notifications?.unreadCount ?? 0) > 0 && (
          <span className="text-xs text-muted-foreground">
            {notifications!.unreadCount} unread
          </span>
        )}
        <Link
          href="/notifications"
          className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        {loading ? (
          <div className="divide-y">
            {[1, 2, 3, 4].map((i) => <ActivitySkeleton key={i} />)}
          </div>
        ) : !items.length ? (
          <EmptyActivity />
        ) : (
          <ul className="divide-y">
            {items.map((n) => {
              const { icon: Icon, bg, fg } = getActivityIcon(n.title);
              return (
                <li key={n.id}>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className={cn('mt-1 flex size-7 shrink-0 items-center justify-center rounded-full', bg)}>
                      <Icon className={cn('size-3.5', fg)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm', n.isRead ? 'text-muted-foreground' : 'font-medium')}>
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {n.body}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function EmptyActivity() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Sparkles className="size-8 text-muted-foreground/40" />
      <p className="text-sm font-medium">No activity yet</p>
      <p className="text-xs text-muted-foreground">
        Activity will appear here once you join or create a group.
      </p>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Skeleton className="mt-1 size-7 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  );
}
