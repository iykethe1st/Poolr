import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { GroupDetailContent } from '@/components/groups/group-detail-content';

export const metadata: Metadata = { title: 'Group' };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GroupDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <PageShell>
      <GroupDetailContent groupId={id} />
    </PageShell>
  );
}
