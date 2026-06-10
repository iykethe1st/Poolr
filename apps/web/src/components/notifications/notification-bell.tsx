'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellIcon, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useNotificationBell,
  useMarkRead,
  useMarkAllRead,
  type Notification,
} from '@/hooks/use-notifications';
import { timeAgo } from '@/lib/format';
import { requestPushPermission } from '@/lib/push';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const { data, isLoading } = useNotificationBell();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const [open, setOpen] = useState(false);

  // Request push permission once on mount (silently fails if not configured)
  useEffect(() => {
    requestPushPermission();
  }, []);

  const unreadCount = data?.unreadCount ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <BellIcon className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              {markAllRead.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCheck className="size-3" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && data?.items.length === 0 && (
            <div className="py-8 text-center">
              <BellIcon className="mx-auto size-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">No notifications yet</p>
            </div>
          )}

          {!isLoading &&
            data?.items.map((n) => (
              <NotifRow
                key={n.id}
                notification={n}
                onRead={() => {
                  if (!n.isRead) markRead.mutate(n.id);
                  setOpen(false);
                }}
              />
            ))}
        </div>

        <div className="border-t px-4 py-2.5">
          <Link
            href="/notifications"
            className="block text-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotifRow({
  notification: n,
  onRead,
}: {
  notification: Notification;
  onRead: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'w-full px-4 py-3 text-left transition-colors hover:bg-muted/50',
        !n.isRead && 'bg-primary/5',
      )}
      onClick={onRead}
    >
      <div className="flex items-start gap-2.5">
        {!n.isRead && (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
        )}
        <div className={cn('flex-1', n.isRead && 'pl-4')}>
          <p className="text-sm font-medium leading-snug">{n.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
        </div>
      </div>
    </button>
  );
}
