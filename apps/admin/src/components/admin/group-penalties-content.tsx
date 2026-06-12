'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PenaltyTable } from './penalty-table';
import { useAdminPenalties, useAdminGroups } from '@/hooks/use-admin';

interface GroupPenaltiesContentProps {
  groupId: string;
}

export function GroupPenaltiesContent({ groupId }: GroupPenaltiesContentProps) {
  const { data: groups } = useAdminGroups();
  const { data: allPenalties, isLoading } = useAdminPenalties();

  const group = groups?.find((g) => g.id === groupId);
  const penalties = allPenalties?.filter((p) => p.member.group.id === groupId) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/groups/${groupId}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Penalties</h1>
          {group && <p className="text-sm text-muted-foreground">{group.name}</p>}
        </div>
      </div>

      <PenaltyTable penalties={penalties} loading={isLoading} />
    </div>
  );
}
