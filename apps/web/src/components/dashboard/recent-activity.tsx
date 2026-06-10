import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/format';
import type { NotificationsResult } from '@/hooks/use-dashboard';

interface RecentActivityProps {
  notifications: NotificationsResult | undefined;
  loading: boolean;
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
            {items.map((n) => (
              <li key={n.id}>
                <div className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={cn(
                      'mt-1 flex size-7 shrink-0 items-center justify-center rounded-full',
                      n.isRead ? 'bg-muted' : 'bg-foreground',
                    )}
                  >
                    <Bell
                      className={cn(
                        'size-3.5',
                        n.isRead ? 'text-muted-foreground' : 'text-background',
                      )}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm',
                        n.isRead ? 'text-muted-foreground' : 'font-medium',
                      )}
                    >
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
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EmptyActivity() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Bell className="size-8 text-muted-foreground/40" />
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
