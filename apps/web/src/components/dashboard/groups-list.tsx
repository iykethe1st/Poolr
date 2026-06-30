'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HTTPError } from 'ky';
import { LinkIcon, Mail, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { GroupCard } from './group-card';
import type { GroupWithMembers, ContributionWithGroup } from '@/hooks/use-dashboard';
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
  return (
    <Link
      href={`/groups/${group.id}/join`}
      className="flex items-center justify-between gap-3 rounded-xl border border-dashed bg-card px-4 py-3 transition-colors hover:bg-muted/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{group.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(group.contributionAmount, group.currency)} &nbsp;·&nbsp;{' '}
          {formatFrequency(group.frequency)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          Review invite →
        </span>
      </div>
    </Link>
  );
}

function EmptyGroups() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleJoin() {
    setLinkError('');
    const trimmed = link.trim();

    // Accept either a full URL (https://...poolr.ng/groups/{id}/join?token=...)
    // or a bare token string
    let groupId: string | null = null;
    let token: string | null = null;

    try {
      const url = new URL(trimmed);
      // Extract /groups/{id}/join path
      const match = url.pathname.match(/\/groups\/([^/]+)\/join/);
      if (match) {
        groupId = match[1];
        token = url.searchParams.get('token');
      }
    } catch {
      // Not a URL — treat as a raw token
      token = trimmed;
    }

    if (!token) {
      setLinkError('Paste the full invite link you received from the group admin.');
      return;
    }

    if (groupId) {
      router.push(`/groups/${groupId}/join?token=${encodeURIComponent(token)}`);
    } else {
      // Token-only: go to a generic join route that resolves via the API
      router.push(`/groups/join-by-token?token=${encodeURIComponent(token)}`);
    }
    setOpen(false);
    setLink('');
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <LinkIcon className="size-5 text-primary" />
            </div>
            <DialogTitle>Join with invite link</DialogTitle>
            <DialogDescription>
              Paste the invite link shared by the group admin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Input
              ref={inputRef}
              placeholder="https://app.poolr.ng/groups/…/join?token=…"
              value={link}
              onChange={(e) => { setLink(e.target.value); setLinkError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              autoFocus
            />
            {linkError && <p className="text-xs text-destructive">{linkError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleJoin} disabled={!link.trim()}>Join group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <LinkIcon className="size-3.5" />
            Join with invite
          </Button>
        </div>
      </div>
    </>
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
