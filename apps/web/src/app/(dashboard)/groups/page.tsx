import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { GroupsContent } from '@/components/groups/groups-content';

export const metadata: Metadata = { title: 'Groups' };

export default function GroupsPage() {
  return (
    <PageShell>
      <GroupsContent />
    </PageShell>
  );
}
