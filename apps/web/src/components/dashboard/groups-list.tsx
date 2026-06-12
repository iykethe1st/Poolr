'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Mail, Plus, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupCard } from './group-card';
import type { GroupWithMembers, ContributionWithGroup } from '@/hooks/use-dashboard';
import { useAcceptInvite, useDeclineInvite } from '@/hooks/use-group';
import { formatCurrency, formatFrequency } from '@/lib/format';

interface GroupsListProps {
  groups: GroupWithMembers[] | undefined;
  contributions: ContributionWithGroup[];
  userId: string | undefined;
  loading: boolean;
}

export function GroupsList({ groups, contributions, userId, loading }: GroupsListProps) {
  const myGroups = groups?.filter((g) => {
    const m = g.members.find((m) => m.userId === userId);
    return !m || m.memberStatus !== 'INVITED';
  });

  const pendingInvites = groups?.filter((g) => {
    const m = g.members.find((m) => m.userId === userId);
    return m?.memberStatus === 'INVITED';
  });

  return (
    <div className="space-y-6">
      {/* Pending invites */}
      {!loading && !!pendingInvites?.length && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" />
            <h3 className="font-semibold">Pending invites</h3>
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {pendingInvites.length}
            </span>
          </div>
          <div className="space-y-2">
            {pendingInvites.map((group) => (
              <InviteCard key={group.id} group={group} />
            ))}
          </div>
        </section>
      )}

      {/* My groups */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">My groups</h3>
          <Button size="sm" variant="outline" asChild>
            <Link href="/groups/new">
              <Plus className="size-3.5" />
              New group
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <GroupSkeleton key={i} />)}
          </div>
        ) : !myGroups?.length ? (
          <EmptyGroups />
        ) : (
          <div className="space-y-3">
            {myGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                userId={userId}
                contributions={contributions}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function InviteCard({ group }: { group: GroupWithMembers }) {
  const router = useRouter();
  const accept = useAcceptInvite(group.id);
  const decline = useDeclineInvite(group.id);
  const busy = accept.isPending || decline.isPending;

  async function handleAccept(e: React.MouseEvent) {
    e.preventDefault();
    await accept.mutateAsync();
    router.push(`/groups/${group.id}`);
  }

  async function handleDecline(e: React.MouseEvent) {
    e.preventDefault();
    await decline.mutateAsync();
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed bg-card px-4 py-3">
      <Link href={`/groups/${group.id}`} className="min-w-0 flex-1">
        <p className="truncate font-medium">{group.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(group.contributionAmount, group.currency)} &nbsp;·&nbsp;{' '}
          {formatFrequency(group.frequency)}
        </p>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={handleAccept}
          disabled={busy}
        >
          {accept.isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          Accept
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={handleDecline}
          disabled={busy}
        >
          {decline.isPending ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
          Decline
        </Button>
      </div>
    </div>
  );
}

function EmptyGroups() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Users className="size-6 text-muted-foreground" />
      </span>
      <div>
        <p className="font-medium">No groups yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new savings circle or ask a group admin to invite you.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" asChild>
          <Link href="/groups/new">Create a group</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/groups/join">Join with invite</Link>
        </Button>
      </div>
    </div>
  );
}

function GroupSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-14" />
      </div>
    </div>
  );
}
