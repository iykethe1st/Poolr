import type { Metadata } from 'next';
import { GroupDetailContent } from '@/components/admin/group-detail-content';

export const metadata: Metadata = { title: 'Group Detail' };

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GroupDetailContent groupId={id} />;
}
