'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HTTPError } from 'ky';
import { Check, Loader2, Mail, Plus, ShieldCheck, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/page-shell';
import { useGroups, useCurrentUser, type GroupWithMembers } from '@/hooks/use-dashboard';
import { useDeclineInvite, useJoinByToken } from '@/hooks/use-group';
import { formatCurrency, formatFrequency, formatGroupStatus } from '@/lib/format';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'destructive' | 'default'> = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  PAUSED: 'outline',
  COMPLETED: 'default',
  CANCELLED: 'destructive',
};

export function GroupsContent() {
  const router = useRouter();
  const { data: groups, isLoading } = useGroups();
  const { data: me } = useCurrentUser();
  const userId = me?.id;
  const [kycDialogOpen, setKycDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  function handleNewGroup() {
    if (me && me.kycProfile?.kycStatus !== 'VERIFIED') {
      setKycDialogOpen(true);
    } else {
      router.push('/groups/new');
    }
  }

  const myGroups = groups?.filter((g) => {
    const m = g.members.find((m) => m.userId === userId);
    return !m || m.memberStatus !== 'INVITED';
  });

  const pendingInvites = groups?.filter((g) => {
    const m = g.members.find((m) => m.userId === userId);
    return m?.memberStatus === 'INVITED';
  });

  return (
    <>
    <Dialog open={kycDialogOpen} onOpenChange={setKycDialogOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-amber-100">
            <ShieldCheck className="size-6 text-amber-600" />
          </div>
          <DialogTitle>Identity verification required</DialogTitle>
          <DialogDescription>
            You need to verify your identity before creating a savings group. This protects
            all members of your circle.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setKycDialogOpen(false)}>
            Not now
          </Button>
          <Button asChild>
            <Link href={`/kyc?redirect=${encodeURIComponent('/groups/new')}`}>Verify identity</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div className="space-y-8">
      <JoinByTokenDialog open={joinDialogOpen} onClose={() => setJoinDialogOpen(false)} />
      <PageHeader title="Groups" description="Your savings circles">
        <Button size="sm" variant="outline" onClick={() => setJoinDialogOpen(true)}>
          Join group
        </Button>
        <Button size="sm" onClick={handleNewGroup}>
          <Plus className="size-3.5" />
          New group
        </Button>
      </PageHeader>

      {/* ── Pending invites ──────────────────────────────────────────────────── */}
      {!isLoading && !!pendingInvites?.length && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" />
            <h2 className="font-semibold">Pending invites</h2>
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {pendingInvites.length}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingInvites.map((group) => (
              <InviteCard key={group.id} group={group} />
            ))}
          </div>
        </section>
      )}

      {/* ── My groups ────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        {!!pendingInvites?.length && <h2 className="font-semibold">My groups</h2>}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        ) : !myGroups?.length ? (
          <EmptyGroups onCreateGroup={handleNewGroup} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myGroups.map((group) => (
              <GroupCard key={group.id} group={group} currentUserId={userId} />
            ))}
          </div>
        )}
      </section>
    </div>
    </>
  );
}

function InviteCard({ group }: { group: GroupWithMembers }) {
  const decline = useDeclineInvite(group.id);
  const [error, setError] = useState('');
  const busy = decline.isPending;

  function handleDecline(e: React.MouseEvent) {
    e.preventDefault();
    decline.mutate(undefined, {
      onError: () => setError('Failed to decline. Please try again.'),
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed bg-card p-5 shadow-sm">
        <Link href={`/groups/${group.id}`} className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{group.name}</p>
            <p className="text-xs text-muted-foreground">{formatFrequency(group.frequency)}</p>
          </div>
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            Invited
          </span>
        </Link>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xl font-bold">
              {formatCurrency(group.contributionAmount, group.currency)}
            </p>
            <p className="text-xs text-muted-foreground">per member</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{group.members.filter((m) => m.memberStatus === 'ACTIVE').length} / {group.maxMembers}</p>
            <p className="text-xs text-muted-foreground">members</p>
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2 border-t pt-3">
          <Button size="sm" className="flex-1" asChild>
            <Link href={`/groups/${group.id}/join`}>
              <Check className="size-3.5" />
              Review &amp; accept
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={handleDecline} disabled={busy}>
            {decline.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
            Decline
          </Button>
        </div>
      </div>
  );
}

function GroupCard({ group, currentUserId }: { group: GroupWithMembers; currentUserId?: string }) {
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
          <p className="text-xs text-muted-foreground">{formatFrequency(group.frequency)}</p>
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
          <p className="text-sm font-medium">{activeCount} / {group.maxMembers}</p>
          <p className="text-xs text-muted-foreground">members</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        {myMember && <span>Position #{myMember.rotationPosition}</span>}
        {isAdmin && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">Admin</span>
        )}
      </div>
    </Link>
  );
}

function EmptyGroups({ onCreateGroup }: { onCreateGroup: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card py-16 text-center shadow-sm">
      <Users className="size-10 text-muted-foreground/40" />
      <div>
        <p className="font-medium">No groups yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a group to start saving with your community.
        </p>
      </div>
      <Button size="sm" onClick={onCreateGroup}>
        <Plus className="size-3.5" />
        Create group
      </Button>
    </div>
  );
}

function JoinByTokenDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const join = useJoinByToken();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setError('');
    join.mutate(token.trim(), {
      onSuccess: () => {
        setToken('');
        onClose();
      },
      onError: async (err) => {
        if (err instanceof HTTPError) {
          const body: { message?: string } = await err.response.json().catch(() => ({}));
          setError(body.message ?? 'Invalid or expired invite token. Please try again.');
        } else {
          setError('Invalid or expired invite token. Please try again.');
        }
      },
    });
  }

  function handleClose() {
    setToken('');
    setError('');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Join a group</DialogTitle>
          <DialogDescription>
            Enter the invite token sent to you via SMS or email from your group admin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-token">Invite token</Label>
            <Input
              id="invite-token"
              placeholder="Paste your invite token here"
              value={token}
              onChange={(e) => { setToken(e.target.value); setError(''); }}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={!token.trim() || join.isPending}>
              {join.isPending && <Loader2 className="size-4 animate-spin" />}
              Join group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
