import type { Metadata } from 'next';
import { PageShell, PageHeader } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's an overview of your savings."
      />
      {/* Placeholder stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 shadow-sm">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
