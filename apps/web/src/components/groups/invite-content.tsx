'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-shell';
import { InviteForm } from './invite-form';
import { useGroup } from '@/hooks/use-group';
import { useCurrentUser } from '@/hooks/use-dashboard';

interface InviteContentProps {
  groupId: string;
}

export function InviteContent({ groupId }: InviteContentProps) {
  const { data: group, isLoading } = useGroup(groupId);
  const { data: me } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!group) return <p className="text-sm text-muted-foreground">Group not found.</p>;

  const isAdmin = me?.id === group.adminId;
  const isDraft = group.status === 'DRAFT';
  const activeCount = group.members.filter((m) => m.memberStatus === 'ACTIVE').length;
  const isFull = activeCount >= group.maxMembers;

  if (!isAdmin || !isDraft) {
    return (
      <div className="mx-auto max-w-lg">
        <p className="text-sm text-muted-foreground">
          {!isAdmin
            ? 'Only the group admin can invite members.'
            : 'Members can only be invited while the group is in draft.'}
        </p>
        <Button variant="link" asChild className="pl-0 mt-2">
          <Link href={`/groups/${groupId}`}>Go back to group</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/groups/${groupId}`}>
            <ArrowLeft className="size-3.5" />
            Back to group
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Invite a member"
        description={`${group.name} · ${activeCount} / ${group.maxMembers} members`}
      />

      {isFull ? (
        <div className="rounded-xl border bg-muted/40 px-4 py-6 text-center">
          <p className="text-sm font-medium">Group is full</p>
          <p className="text-xs text-muted-foreground mt-1">
            All {group.maxMembers} slots are filled.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <InviteForm groupId={groupId} groupName={group.name} />
        </div>
      )}

      {/* Existing invited/pending members */}
      {group.members.filter((m) => m.memberStatus === 'INVITED').length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Pending invites</h3>
          <ul className="space-y-1">
            {group.members
              .filter((m) => m.memberStatus === 'INVITED')
              .map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
                >
                  <span>{m.user.fullName}</span>
                  <span className="text-xs text-muted-foreground">{m.user.phone}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
