import type { Metadata } from 'next';
import { GroupPayoutsContent } from '@/components/admin/group-payouts-content';

export const metadata: Metadata = { title: 'Payouts' };

export default async function GroupPayoutsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GroupPayoutsContent groupId={id} />;
}
