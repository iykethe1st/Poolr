import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { InviteContent } from '@/components/groups/invite-content';

export const metadata: Metadata = { title: 'Invite Member' };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { id } = await params;
  return (
    <PageShell>
      <InviteContent groupId={id} />
    </PageShell>
  );
}
