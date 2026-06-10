'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-shell';
import { RotationOrder } from './rotation-order';
import { CycleTimeline } from './cycle-timeline';
import { StartGroupModal } from './start-group-modal';
import { useGroup } from '@/hooks/use-group';
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
  const activeMembers = group.members.filter((m) => m.memberStatus === 'ACTIVE');
  const isDraft = group.status === 'DRAFT';
  const isLive = ['ACTIVE', 'PAUSED', 'COMPLETED'].includes(group.status);

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
        <InfoCard
          icon={CalendarDays}
          label="Start date"
          value={
            group.startDate
              ? new Date(group.startDate).toLocaleDateString('en-NG', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Not set'
          }
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
