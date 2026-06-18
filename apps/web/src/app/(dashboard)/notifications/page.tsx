import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { NotificationsContent } from '@/components/notifications/notifications-content';

export const metadata: Metadata = { title: 'Notifications' };

export default function NotificationsPage() {
  return (
    <PageShell>
      <NotificationsContent />
    </PageShell>
  );
}
