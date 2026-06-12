'use client';

import Link from 'next/link';
import { Users, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminGroups } from '@/hooks/use-admin';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  DRAFT: { label: 'Draft', color: 'text-muted-foreground bg-muted border-border' },
  PAUSED: { label: 'Paused', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  COMPLETED: { label: 'Completed', color: 'text-muted-foreground bg-muted border-border' },
  CANCELLED: { label: 'Cancelled', color: 'text-destructive bg-destructive/5 border-destructive/20' },
};

export function GroupsContent() {
  const { data: groups, isLoading } = useAdminGroups();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Groups</h1>
        <p className="text-sm text-muted-foreground">All savings groups on the platform.</p>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      )}

      {!isLoading && !groups?.length && (
        <div className="rounded-xl border bg-card py-16 text-center">
          <Users className="mx-auto size-10 text-muted-foreground/30" />
          <p className="mt-3 font-medium text-muted-foreground">No groups yet</p>
        </div>
      )}

      {!isLoading && groups && groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const cfg = STATUS_CONFIG[g.status] ?? { label: g.status, color: '' };
            return (
              <div key={g.id} className="flex flex-col rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{g.name}</h3>
                  <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', cfg.color)}>
                    {cfg.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Admin: {g.admin.fullName}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Contribution</p>
                    <p className="font-medium">{formatCurrency(g.contributionAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Members</p>
                    <p className="font-medium">{g.stats.totalMembers} / {g.maxMembers}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cycles</p>
                    <p className="font-medium">{g.stats.totalCycles}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Collected</p>
                    <p className="font-medium">{formatCurrency(g.stats.totalCollectedNgn)}</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/groups/${g.id}`}>
                      View matrix
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
