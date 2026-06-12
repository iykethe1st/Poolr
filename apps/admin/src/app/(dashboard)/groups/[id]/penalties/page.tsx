import type { Metadata } from 'next';
import { GroupPenaltiesContent } from '@/components/admin/group-penalties-content';

export const metadata: Metadata = { title: 'Penalties' };

export default async function GroupPenaltiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GroupPenaltiesContent groupId={id} />;
}
