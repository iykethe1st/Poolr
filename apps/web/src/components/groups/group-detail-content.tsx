'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Loader2,
  Pencil,
  Settings,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-shell';
import { RotationOrder } from './rotation-order';
import { CycleTimeline } from './cycle-timeline';
import { StartGroupModal } from './start-group-modal';
import { useGroup, useUpdateGroup, useAcceptInvite, useDeclineInvite } from '@/hooks/use-group';
import { useCurrentUser } from '@/hooks/use-dashboard';
import { formatCurrency, formatFrequency, formatGroupStatus } from '@/lib/format';

const GROUP_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'destructive' | 'default'> = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  PAUSED: 'outline',
  COMPLETED: 'default',
  CANCELLED: 'destructive',
};

interface GroupDetailContentProps {
  groupId: string;
}

export function GroupDetailContent({ groupId }: GroupDetailContentProps) {
  const { data: group, isLoading } = useGroup(groupId);
  const { data: me } = useCurrentUser();

  if (isLoading) return <GroupDetailSkeleton />;
  if (!group) return <p className="text-sm text-muted-foreground">Group not found.</p>;

  const isAdmin = me?.id === group.adminId;
  const myMember = group.members.find((m) => m.userId === me?.id);
  const isInvited = myMember?.memberStatus === 'INVITED';
  const activeMembers = group.members.filter((m) => m.memberStatus === 'ACTIVE');
  const isDraft = group.status === 'DRAFT';
  const isLive = ['ACTIVE', 'PAUSED', 'COMPLETED'].includes(group.status);
  const canEditStartDate = isAdmin && isDraft;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
        </Button>
      </div>

      {isInvited && <InviteBanner groupId={groupId} />}

      <PageHeader
        title={group.name}
        description={`${formatFrequency(group.frequency)} · ${formatCurrency(group.contributionAmount, group.currency)} per member`}
      >
        <Badge variant={GROUP_STATUS_VARIANT[group.status] ?? 'outline'}>
          {formatGroupStatus(group.status)}
        </Badge>

        {isAdmin && isDraft && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/groups/${groupId}/invite`}>
              <UserPlus className="size-3.5" />
              Invite
            </Link>
          </Button>
        )}

        {isAdmin && isDraft && <StartGroupModal group={group} />}
      </PageHeader>

      {/* ── Info cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard
          icon={Users}
          label="Members"
          value={`${activeMembers.length} / ${group.maxMembers}`}
        />
        <StartDateCard
          groupId={groupId}
          startDate={group.startDate}
          canEdit={canEditStartDate}
        />
        <InfoCard
          icon={CalendarDays}
          label="Payout per cycle"
          value={formatCurrency(
            group.contributionAmount * activeMembers.length,
            group.currency,
          )}
        />
        <InfoCard
          icon={CalendarDays}
          label="Total cycles"
          value={isLive ? String(group.cycles.length) : String(activeMembers.length)}
        />
      </div>

      {/* ── Draft: rotation order ────────────────────────────────────────────── */}
      {isDraft && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Rotation order</h3>
              <p className="text-xs text-muted-foreground">
                {isAdmin
                  ? 'Drag to reorder. Locked once the group starts.'
                  : 'Your rotation position is highlighted below.'}
              </p>
            </div>
            {isAdmin && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/groups/${groupId}/members`}>
                  <Settings className="size-3.5" />
                  Manage
                </Link>
              </Button>
            )}
          </div>

          {activeMembers.length === 0 ? (
            <div className="rounded-xl border bg-card px-4 py-10 text-center">
              <Users className="mx-auto mb-2 size-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">No active members yet</p>
              {isAdmin && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <Link href={`/groups/${groupId}/invite`} className="underline">
                    Invite members
                  </Link>{' '}
                  to get started.
                </p>
              )}
            </div>
          ) : (
            <RotationOrder
              groupId={groupId}
              members={group.members.filter((m) => ['ACTIVE', 'INVITED'].includes(m.memberStatus))}
              isAdmin={isAdmin}
              locked={false}
            />
          )}
        </section>
      )}

      {/* ── Live: cycle timeline ─────────────────────────────────────────────── */}
      {isLive && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Cycle timeline</h3>
              <p className="text-xs text-muted-foreground">
                {group.cycles.length} cycles · {activeMembers.length} members
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/groups/${groupId}/members`}>
                <Users className="size-3.5" />
                Members
              </Link>
            </Button>
          </div>

          {group.cycles.length > 0 ? (
            <CycleTimeline
              cycles={group.cycles}
              members={group.members}
              contributionAmount={group.contributionAmount}
              currency={group.currency}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No cycles generated yet.</p>
          )}
        </section>
      )}

      {/* ── Cancelled ────────────────────────────────────────────────────────── */}
      {group.status === 'CANCELLED' && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
          <p className="text-sm font-medium text-destructive">This group has been cancelled.</p>
        </div>
      )}
    </div>
  );
}

function InviteBanner({ groupId }: { groupId: string }) {
  const router = useRouter();
  const accept = useAcceptInvite(groupId);
  const decline = useDeclineInvite(groupId);
  const [error, setError] = useState('');
  const busy = accept.isPending || decline.isPending;

  async function handleAccept() {
    setError('');
    try {
      await accept.mutateAsync();
      router.refresh();
    } catch {
      setError('Failed to accept. Please try again.');
    }
  }

  async function handleDecline() {
    setError('');
    try {
      await decline.mutateAsync();
      router.push('/groups');
    } catch {
      setError('Failed to decline. Please try again.');
    }
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">You&apos;ve been invited to join this group</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Accept to become an active member and participate in the savings cycle.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={handleAccept} disabled={busy}>
            {accept.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={handleDecline} disabled={busy}>
            {decline.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
            Decline
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function StartDateCard({
  groupId,
  startDate,
  canEdit,
}: {
  groupId: string;
  startDate: string | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    startDate ? new Date(startDate).toISOString().slice(0, 10) : '',
  );
  const update = useUpdateGroup(groupId);

  const formatted = startDate
    ? new Date(startDate).toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Not set';

  function handleSave() {
    update.mutate(
      { startDate: value || undefined },
      { onSuccess: () => setEditing(false) },
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <CalendarDays className="size-4 text-muted-foreground" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">Start date</p>
        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            <input
              type="date"
              value={value}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setValue(e.target.value)}
              className="h-7 rounded border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleSave}
              disabled={update.isPending}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => { setEditing(false); setValue(startDate ? new Date(startDate).toISOString().slice(0, 10) : ''); }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold">{formatted}</p>
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Edit start date"
              >
                <Pencil className="size-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function GroupDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    </div>
  );
}
