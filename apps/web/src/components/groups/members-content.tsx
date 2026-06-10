'use client';

import Link from 'next/link';
import { ArrowLeft, UserPlus, UserCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-shell';
import { useGroup, useRemoveMember, type GroupMember } from '@/hooks/use-group';
import { useCurrentUser } from '@/hooks/use-dashboard';

interface MembersContentProps {
  groupId: string;
}

const MEMBER_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'destructive'> = {
  ACTIVE: 'success',
  INVITED: 'warning',
  LEFT: 'outline',
  REMOVED: 'destructive',
};

const MEMBER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  INVITED: 'Invited',
  LEFT: 'Left',
  REMOVED: 'Removed',
};

export function MembersContent({ groupId }: MembersContentProps) {
  const { data: group, isLoading } = useGroup(groupId);
  const { data: me } = useCurrentUser();

  if (isLoading) return <MembersSkeleton />;
  if (!group) return <p className="text-sm text-muted-foreground">Group not found.</p>;

  const isAdmin = me?.id === group.adminId;
  const isDraft = group.status === 'DRAFT';

  const sortedMembers = [...group.members].sort((a, b) => a.rotationPosition - b.rotationPosition);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/groups/${groupId}`}>
            <ArrowLeft className="size-3.5" />
            Back to group
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Members"
        description={`${group.name} · ${group.members.filter((m) => m.memberStatus === 'ACTIVE').length} active`}
      >
        {isAdmin && isDraft && (
          <Button size="sm" asChild>
            <Link href={`/groups/${groupId}/invite`}>
              <UserPlus className="size-3.5" />
              Invite member
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="rounded-xl border bg-card shadow-sm divide-y">
        {sortedMembers.length === 0 ? (
          <div className="py-10 text-center">
            <UserCircle2 className="mx-auto mb-2 size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No members yet</p>
          </div>
        ) : (
          sortedMembers.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              groupId={groupId}
              isAdmin={isAdmin}
              isDraft={isDraft}
              currentUserId={me?.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MemberRow({
  member,
  groupId,
  isAdmin,
  isDraft,
  currentUserId,
}: {
  member: GroupMember;
  groupId: string;
  isAdmin: boolean;
  isDraft: boolean;
  currentUserId?: string;
}) {
  const removeMember = useRemoveMember(groupId);
  const isMe = member.userId === currentUserId;
  const canRemove = isAdmin && isDraft && !isMe && member.memberStatus === 'INVITED';

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {member.rotationPosition}
      </span>

      <UserCircle2 className="size-8 shrink-0 text-muted-foreground/50" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{member.user.fullName}</p>
          {isMe && (
            <span className="text-xs text-muted-foreground">(you)</span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{member.user.phone}</p>
        <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={MEMBER_STATUS_VARIANT[member.memberStatus] ?? 'outline'}>
          {MEMBER_STATUS_LABEL[member.memberStatus] ?? member.memberStatus}
        </Badge>

        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive hover:text-destructive"
            onClick={() => removeMember.mutate(member.id)}
            disabled={removeMember.isPending}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function MembersSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-10 w-48" />
      <div className="space-y-1">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
