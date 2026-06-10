import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-shell';
import { PageShell } from '@/components/layout/page-shell';
import { CreateGroupForm } from '@/components/groups/create-group-form';

export const metadata: Metadata = { title: 'Create Group' };

export default function NewGroupPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-xl">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/dashboard">
              <ArrowLeft className="size-3.5" />
              Back to dashboard
            </Link>
          </Button>
        </div>

        <PageHeader
          title="Create a group"
          description="Set up your savings group. You can invite members after creation."
        />

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <CreateGroupForm />
        </div>
      </div>
    </PageShell>
  );
}
