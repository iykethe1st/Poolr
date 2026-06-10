'use client';

import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-shell';
import { useGroups, type GroupWithMembers } from '@/hooks/use-dashboard';
import { formatCurrency, formatFrequency, formatGroupStatus } from '@/lib/format';
import { useCurrentUser } from '@/hooks/use-dashboard';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'destructive' | 'default'> = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  PAUSED: 'outline',
  COMPLETED: 'default',
  CANCELLED: 'destructive',
};

export function GroupsContent() {
  const { data: groups, isLoading } = useGroups();
  const { data: me } = useCurrentUser();

  return (
    <div className="space-y-6">
      <PageHeader title="Groups" description="Your savings circles">
        <Button size="sm" asChild>
          <Link href="/groups/new">
            <Plus className="size-3.5" />
            New group
          </Link>
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : !groups?.length ? (
        <EmptyGroups />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} currentUserId={me?.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group,
  currentUserId,
}: {
  group: GroupWithMembers;
  currentUserId?: string;
}) {
  const isAdmin = group.adminId === currentUserId;
  const activeCount = group.members.filter((m) => m.memberStatus === 'ACTIVE').length;
  const myMember = group.members.find((m) => m.userId === currentUserId);

  return (
    <Link
      href={`/groups/${group.id}`}
      className="group flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{group.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatFrequency(group.frequency)}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[group.status] ?? 'outline'}>
          {formatGroupStatus(group.status)}
        </Badge>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold">
            {formatCurrency(group.contributionAmount, group.currency)}
          </p>
          <p className="text-xs text-muted-foreground">per member</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">
            {activeCount} / {group.maxMembers}
          </p>
          <p className="text-xs text-muted-foreground">members</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        {myMember && (
          <span>Position #{myMember.rotationPosition}</span>
        )}
        {isAdmin && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">Admin</span>
        )}
      </div>
    </Link>
  );
}

function EmptyGroups() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card py-16 text-center shadow-sm">
      <Users className="size-10 text-muted-foreground/40" />
      <div>
        <p className="font-medium">No groups yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a group to start saving with your community.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" asChild>
          <Link href="/groups/new">
            <Plus className="size-3.5" />
            Create group
          </Link>
        </Button>
      </div>
    </div>
  );
}
