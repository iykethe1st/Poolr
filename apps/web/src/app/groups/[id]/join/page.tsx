import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { JoinPageContent } from '@/components/groups/join-page-content';

export const metadata: Metadata = { title: 'Join Group' };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function JoinPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <JoinPageContent groupId={id} />
    </Suspense>
  );
}
