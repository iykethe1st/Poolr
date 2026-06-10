import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { MembersContent } from '@/components/groups/members-content';

export const metadata: Metadata = { title: 'Members' };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MembersPage({ params }: Props) {
  const { id } = await params;
  return (
    <PageShell>
      <MembersContent groupId={id} />
    </PageShell>
  );
}
