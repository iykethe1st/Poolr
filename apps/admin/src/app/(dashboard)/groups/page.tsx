import type { Metadata } from 'next';
import { GroupsContent } from '@/components/admin/groups-content';

export const metadata: Metadata = { title: 'Groups' };

export default function GroupsPage() {
  return <GroupsContent />;
}
