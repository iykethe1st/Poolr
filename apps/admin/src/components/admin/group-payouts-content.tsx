'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PayoutTable } from './payout-table';
import { useAdminGroupCycles, useAdminGroups } from '@/hooks/use-admin';

interface GroupPayoutsContentProps {
  groupId: string;
}

export function GroupPayoutsContent({ groupId }: GroupPayoutsContentProps) {
  const { data: groups } = useAdminGroups();
  const { data: cycles, isLoading } = useAdminGroupCycles(groupId);

  const group = groups?.find((g) => g.id === groupId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/groups/${groupId}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Payout history</h1>
          {group && <p className="text-sm text-muted-foreground">{group.name}</p>}
        </div>
      </div>

      <PayoutTable cycles={cycles ?? []} loading={isLoading} />
    </div>
  );
}
