'use client';

import { useState } from 'react';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-shell';
import {
  useNotificationsList,
  useMarkRead,
  useMarkAllRead,
  type Notification,
} from '@/hooks/use-notifications';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

const CHANNEL_LABEL: Record<string, string> = {
  PUSH: 'Push',
  SMS: 'SMS',
  EMAIL: 'Email',
  IN_APP: 'In-app',
};

export function NotificationsContent() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useNotificationsList(page);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const totalPages = data?.totalPages ?? 1;
  const unread = data?.unreadCount ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Your recent activity and alerts.">
        {unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            {markAllRead.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCheck className="size-3.5" />
            )}
            Mark all as read
          </Button>
        )}
      </PageHeader>

      <div className="rounded-xl border bg-card">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <div className="py-16 text-center">
            <Bell className="mx-auto size-10 text-muted-foreground/30" />
            <p className="mt-3 font-medium text-muted-foreground">No notifications yet</p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Activity in your groups will appear here.
            </p>
          </div>
        )}

        {!isLoading && data && data.items.length > 0 && (
          <ul className="divide-y">
            {data.items.map((n) => (
              <NotifItem
                key={n.id}
                notification={n}
                onRead={() => {
                  if (!n.isRead) markRead.mutate(n.id);
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function NotifItem({
  notification: n,
  onRead,
}: {
  notification: Notification;
  onRead: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={cn(
          'w-full px-5 py-4 text-left transition-colors hover:bg-muted/40',
          !n.isRead && 'bg-primary/5',
        )}
        onClick={onRead}
      >
        <div className="flex items-start gap-3">
          {!n.isRead && (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
          )}
          <div className={cn('flex-1', n.isRead && 'pl-5')}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{n.title}</p>
              <div className="flex shrink-0 items-center gap-2">
                {n.channel && (
                  <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                    {CHANNEL_LABEL[n.channel] ?? n.channel}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </div>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
          </div>
        </div>
      </button>
    </li>
  );
}
