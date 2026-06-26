'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HTTPError } from 'ky';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BadgeAlert,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Copy,
  CreditCard,
  Landmark,
  Loader2,
  Pencil,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { PageHeader } from '@/components/layout/page-shell';
import { RotationOrder } from './rotation-order';
import { CycleTimeline } from './cycle-timeline';
import { StartGroupModal } from './start-group-modal';
import {
  useGroup,
  useGroupHistory,
  useUpdateGroup,
  useAcceptInvite,
  useDeclineInvite,
  type GroupDetail,
  type GroupHistory,
  type GroupVirtualAccount,
} from '@/hooks/use-group';
import { useCurrentUser } from '@/hooks/use-dashboard';
import { useInitializeContribution, useWalletContribute } from '@/hooks/use-payments';
import { useWallet } from '@/hooks/use-wallet';
import { formatCurrency, formatFrequency, formatGroupStatus } from '@/lib/format';

const GROUP_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'destructive' | 'default'> = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  PAUSED: 'outline',
  COMPLETED: 'default',
  CANCELLED: 'destructive',
};

const MEMBER_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'destructive' | 'default'> = {
  ACTIVE: 'success',
  INVITED: 'warning',
  LEFT: 'outline',
  REMOVED: 'destructive',
};

const PENALTY_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'destructive' | 'default'> = {
  PENDING: 'warning',
  APPLIED: 'destructive',
  WAIVED: 'outline',
};

const PAYOUT_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'destructive' | 'default'> = {
  PENDING: 'warning',
  INITIATED: 'default',
  COMPLETED: 'success',
  FAILED: 'destructive',
};

type Tab = 'overview' | 'members' | 'activity' | 'payouts' | 'penalties';

interface GroupDetailContentProps {
  groupId: string;
}

export function GroupDetailContent({ groupId }: GroupDetailContentProps) {
  const { data: group, isLoading } = useGroup(groupId);
  const { data: me } = useCurrentUser();
  const [tab, setTab] = useState<Tab>('overview');

  if (isLoading) return <GroupDetailSkeleton />;
  if (!group) return <p className="text-sm text-muted-foreground">Group not found.</p>;

  const isAdmin = me?.id === group.adminId;
  const myMember = group.members.find((m) => m.userId === me?.id);
  const isInvited = myMember?.memberStatus === 'INVITED';
  const activeMembers = group.members.filter((m) => m.memberStatus === 'ACTIVE');
  const isDraft = group.status === 'DRAFT';
  const isLive = ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'].includes(group.status);
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

      {!isInvited && group.groupAccount && (
        <VirtualAccountCard account={group.groupAccount} />
      )}

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

      {isDraft && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoCard icon={Users} label="Members" value={`${activeMembers.length} / ${group.maxMembers}`} />
            <StartDateCard groupId={groupId} startDate={group.startDate} canEdit={canEditStartDate} />
            <InfoCard
              icon={CalendarDays}
              label="Payout per cycle"
              value={formatCurrency(group.contributionAmount * activeMembers.length, group.currency)}
            />
            <InfoCard
              icon={CalendarDays}
              label="Total cycles"
              value={String(activeMembers.length)}
            />
          </div>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Rotation order</h3>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? 'Drag to reorder. Locked once the group starts.' : 'Your rotation position is highlighted below.'}
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
                    <Link href={`/groups/${groupId}/invite`} className="underline">Invite members</Link>{' '}to get started.
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
        </>
      )}

      {isLive && (
        <LiveGroupTabs
          groupId={groupId}
          group={group}
          me={me}
          isAdmin={isAdmin}
          activeMembers={activeMembers}
          tab={tab}
          setTab={setTab}
        />
      )}

      {group.status === 'CANCELLED' && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
          <p className="text-sm font-medium text-destructive">This group has been cancelled.</p>
        </div>
      )}
    </div>
  );
}

function LiveGroupTabs({
  groupId,
  group,
  me,
  isAdmin,
  activeMembers,
  tab,
  setTab,
}: {
  groupId: string;
  group: GroupDetail;
  me: { id: string } | undefined;
  isAdmin: boolean;
  activeMembers: GroupDetail['members'];
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const { data: history, isLoading: histLoading } = useGroupHistory(groupId);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'members', label: 'Members' },
    { key: 'activity', label: 'Activity' },
    { key: 'payouts', label: 'Payouts' },
    { key: 'penalties', label: 'Penalties' },
  ];

  const activeCycle = group.cycles.find(
    (c) => c.status === 'ACTIVE' || c.status === 'OVERDUE',
  );
  const isActiveMember = me && group.members.find((m) => m.userId === me.id)?.memberStatus === 'ACTIVE';

  return (
    <div className="space-y-5">
      {/* Pay CTA banner — shown when there is a payable active cycle */}
      {activeCycle && isActiveMember && (
        <PayCtaBanner
          cycleId={activeCycle.id}
          cycleNumber={activeCycle.cycleNumber}
          dueDate={activeCycle.dueDate}
          contributionAmount={group.contributionAmount}
          currency={group.currency}
        />
      )}

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border bg-muted/40 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={[
              'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <OverviewTab
          groupId={groupId}
          group={group}
          activeMembers={activeMembers}
          me={me}
          potValueNgn={history?.potValueNgn}
          histLoading={histLoading}
        />
      )}

      {/* Members */}
      {tab === 'members' && (
        <MembersTab
          allMembers={history?.allMembers ?? []}
          contributions={history?.contributions ?? []}
          currentUserId={me?.id}
          isLoading={histLoading}
        />
      )}

      {/* Activity */}
      {tab === 'activity' && (
        <ActivityTab history={history} isLoading={histLoading} currency={group.currency} />
      )}

      {/* Payouts */}
      {tab === 'payouts' && (
        <PayoutsTab payouts={history?.payouts ?? []} isLoading={histLoading} currency={group.currency} />
      )}

      {/* Penalties */}
      {tab === 'penalties' && (
        <PenaltiesTab penalties={history?.penalties ?? []} isLoading={histLoading} currency={group.currency} />
      )}
    </div>
  );
}

function OverviewTab({
  groupId,
  group,
  activeMembers,
  me,
  potValueNgn,
  histLoading,
}: {
  groupId: string;
  group: GroupDetail;
  activeMembers: GroupDetail['members'];
  me: { id: string } | undefined;
  potValueNgn: number | undefined;
  histLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={Users} label="Members" value={`${activeMembers.length} / ${group.maxMembers}`} />
        <InfoCard
          icon={CalendarDays}
          label="Payout per cycle"
          value={formatCurrency(group.contributionAmount * activeMembers.length, group.currency)}
        />
        <InfoCard
          icon={CalendarDays}
          label="Total cycles"
          value={String(group.cycles.length)}
        />
        <InfoCard
          icon={Wallet}
          label="Current pot"
          value={histLoading ? '—' : formatCurrency(potValueNgn ?? 0, group.currency)}
          highlight={!!potValueNgn}
        />
      </div>

      <div>
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
            currentUserId={me?.id}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No cycles generated yet.</p>
        )}
      </div>
    </div>
  );
}

function MembersTab({
  allMembers,
  contributions,
  currentUserId,
  isLoading,
}: {
  allMembers: GroupHistory['allMembers'];
  contributions: GroupHistory['contributions'];
  currentUserId: string | undefined;
  isLoading: boolean;
}) {
  if (isLoading) return <TabSkeleton />;

  // Contribution reliability per member
  const memberStats = contributions.reduce<Record<string, { paid: number; onTime: number }>>((acc, c) => {
    if (!acc[c.memberId]) acc[c.memberId] = { paid: 0, onTime: 0 };
    if (c.status === 'PAID') {
      acc[c.memberId].paid++;
      if (c.paidAt && c.dueAt && new Date(c.paidAt) <= new Date(c.dueAt)) {
        acc[c.memberId].onTime++;
      }
    }
    return acc;
  }, {});

  const current = allMembers.filter((m) => ['ACTIVE', 'INVITED'].includes(m.memberStatus));
  const former = allMembers.filter((m) => ['LEFT', 'REMOVED'].includes(m.memberStatus));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Current members ({current.length})
        </h3>
        {current.length === 0 ? (
          <EmptyState icon={Users} text="No current members" />
        ) : (
          <div className="space-y-2">
            {current.map((m) => {
              const stat = memberStats[m.id];
              const onTimeRate = stat && stat.paid > 0 ? Math.round((stat.onTime / stat.paid) * 100) : null;
              const isVerified = m.user.kycProfile?.kycStatus === 'VERIFIED';
              return (
                <div
                  key={m.id}
                  className={[
                    'flex items-center gap-3 rounded-xl border bg-card px-4 py-3',
                    m.userId === currentUserId ? 'ring-1 ring-primary/30' : '',
                  ].join(' ')}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    #{m.rotationPosition}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium">
                        {m.user.fullName}
                        {m.userId === currentUserId && (
                          <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                        )}
                      </p>
                      {isVerified && (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-950/50 dark:text-green-400">
                          <ShieldCheck className="mr-0.5 size-2.5" />
                          Verified
                        </span>
                      )}
                      {m.tier && m.tier !== 'NEW' && (
                        <span className={[
                          'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                          m.tier === 'PLATINUM' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400' :
                          m.tier === 'GOLD'     ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400' :
                          m.tier === 'SILVER'   ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' :
                                                  'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
                        ].join(' ')}>
                          {m.tier === 'PLATINUM' ? '💎' : m.tier === 'GOLD' ? '🥇' : m.tier === 'SILVER' ? '🥈' : '🥉'}{' '}
                          {m.tier.charAt(0) + m.tier.slice(1).toLowerCase()}
                        </span>
                      )}
                    </div>
                    {onTimeRate !== null ? (
                      <p className={[
                        'text-xs font-medium',
                        onTimeRate === 100 ? 'text-green-600 dark:text-green-400'
                          : onTimeRate >= 75 ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400',
                      ].join(' ')}>
                        {onTimeRate}% on time · {stat!.paid} contribution{stat!.paid !== 1 ? 's' : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{m.user.email}</p>
                    )}
                  </div>
                  <Badge variant={MEMBER_STATUS_VARIANT[m.memberStatus] ?? 'outline'} className="text-xs">
                    {m.memberStatus === 'INVITED' ? 'Pending' : 'Active'}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {former.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Former members ({former.length})
          </h3>
          <div className="space-y-2">
            {former.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border bg-card/50 px-4 py-3 opacity-70">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                  #{m.rotationPosition}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{m.user.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.memberStatus === 'LEFT' ? 'Left' : 'Removed'}{' '}
                    · joined {formatDate(m.joinedAt)}
                  </p>
                </div>
                <Badge variant={MEMBER_STATUS_VARIANT[m.memberStatus] ?? 'outline'} className="text-xs">
                  {m.memberStatus === 'LEFT' ? 'Left' : 'Removed'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type ActivityItem =
  | { type: 'contribution'; date: string; memberName: string; amountNgn: number; cycleNumber: number }
  | { type: 'payout'; date: string; recipientName: string; amountNgn: number; cycleNumber: number }
  | { type: 'joined'; date: string; memberName: string }
  | { type: 'penalty'; date: string; memberName: string; amountNgn: number };

function buildFeed(history: GroupHistory): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const c of history.contributions) {
    if (c.status === 'PAID' && c.paidAt) {
      items.push({
        type: 'contribution',
        date: c.paidAt,
        memberName: c.member.user.fullName,
        amountNgn: Number(c.amount),
        cycleNumber: c.cycle.cycleNumber,
      });
    }
  }

  for (const p of history.payouts) {
    items.push({
      type: 'payout',
      date: p.initiatedAt ?? p.createdAt,
      recipientName: p.recipient.fullName,
      amountNgn: Number(p.amount),
      cycleNumber: p.cycle.cycleNumber,
    });
  }

  for (const m of history.allMembers) {
    if (m.memberStatus === 'ACTIVE' || m.memberStatus === 'LEFT' || m.memberStatus === 'REMOVED') {
      items.push({ type: 'joined', date: m.joinedAt, memberName: m.user.fullName });
    }
  }

  for (const pen of history.penalties) {
    if (pen.status === 'APPLIED') {
      items.push({
        type: 'penalty',
        date: pen.appliedAt ?? pen.createdAt,
        memberName: pen.member.user.fullName,
        amountNgn: Number(pen.penaltyAmount),
      });
    }
  }

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function ActivityTab({
  history,
  isLoading,
  currency,
}: {
  history: GroupHistory | undefined;
  isLoading: boolean;
  currency: string;
}) {
  if (isLoading) return <TabSkeleton />;
  if (!history) return null;

  const feed = buildFeed(history);

  if (feed.length === 0) {
    return <EmptyState icon={Clock} text="No activity yet" subtext="Contributions and payouts will appear here." />;
  }

  return (
    <div className="space-y-2">
      {feed.map((item, i) => {
        if (item.type === 'contribution') {
          return (
            <ActivityRow
              key={i}
              icon={<CircleDollarSign className="size-4 text-green-600 dark:text-green-400" />}
              iconBg="bg-green-100 dark:bg-green-950/40"
              title={`${item.memberName} paid`}
              sub={`Cycle ${item.cycleNumber}`}
              right={formatCurrency(item.amountNgn, currency)}
              rightClass="text-green-600 font-semibold"
              date={item.date}
            />
          );
        }
        if (item.type === 'payout') {
          return (
            <ActivityRow
              key={i}
              icon={<ArrowUpRight className="size-4 text-blue-600 dark:text-blue-400" />}
              iconBg="bg-blue-100 dark:bg-blue-950/40"
              title={`${item.recipientName} received payout`}
              sub={`Cycle ${item.cycleNumber}`}
              right={formatCurrency(item.amountNgn, currency)}
              rightClass="text-blue-600 dark:text-blue-400 font-semibold"
              date={item.date}
            />
          );
        }
        if (item.type === 'joined') {
          return (
            <ActivityRow
              key={i}
              icon={<UserPlus className="size-4 text-muted-foreground" />}
              iconBg="bg-muted"
              title={`${item.memberName} joined`}
              date={item.date}
            />
          );
        }
        if (item.type === 'penalty') {
          return (
            <ActivityRow
              key={i}
              icon={<AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />}
              iconBg="bg-amber-100 dark:bg-amber-950/40"
              title={`Penalty applied to ${item.memberName}`}
              right={formatCurrency(item.amountNgn, currency)}
              rightClass="text-amber-600 dark:text-amber-400 font-semibold"
              date={item.date}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

function ActivityRow({
  icon,
  iconBg,
  title,
  sub,
  right,
  rightClass,
  date,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  sub?: string;
  right?: string;
  rightClass?: string;
  date: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">
          {sub ? `${sub} · ` : ''}{formatDate(date)}
        </p>
      </div>
      {right && <span className={`text-sm shrink-0 ${rightClass ?? ''}`}>{right}</span>}
    </div>
  );
}

function PayoutsTab({
  payouts,
  isLoading,
  currency,
}: {
  payouts: GroupHistory['payouts'];
  isLoading: boolean;
  currency: string;
}) {
  if (isLoading) return <TabSkeleton />;

  if (payouts.length === 0) {
    return <EmptyState icon={Wallet} text="No payouts yet" subtext="Payouts are triggered when all members contribute for a cycle." />;
  }

  return (
    <div className="space-y-2">
      {payouts.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/40">
            {p.status === 'COMPLETED' ? (
              <CheckCircle2 className="size-4 text-blue-600 dark:text-blue-400" />
            ) : p.status === 'FAILED' ? (
              <BadgeAlert className="size-4 text-destructive" />
            ) : (
              <Clock className="size-4 text-muted-foreground" />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{p.recipient.fullName}</p>
            <p className="text-xs text-muted-foreground">
              Cycle {p.cycle.cycleNumber} · {formatDate(p.initiatedAt ?? p.createdAt)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold">{formatCurrency(Number(p.amount), currency)}</p>
            <Badge variant={PAYOUT_STATUS_VARIANT[p.status] ?? 'outline'} className="text-xs">
              {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function PenaltiesTab({
  penalties,
  isLoading,
  currency,
}: {
  penalties: GroupHistory['penalties'];
  isLoading: boolean;
  currency: string;
}) {
  if (isLoading) return <TabSkeleton />;

  if (penalties.length === 0) {
    return <EmptyState icon={CheckCircle2} text="No penalties" subtext="All members have been contributing on time." />;
  }

  const reasonLabel: Record<string, string> = {
    LATE_PAYMENT: 'Late payment',
    MISSED_PAYMENT: 'Missed payment',
    INSUFFICIENT_FUNDS: 'Insufficient funds',
  };

  return (
    <div className="space-y-2">
      {penalties.map((pen) => (
        <div key={pen.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
            {pen.status === 'WAIVED' ? (
              <CheckCircle2 className="size-4 text-green-600" />
            ) : (
              <AlertTriangle className="size-4 text-amber-600" />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{pen.member.user.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {reasonLabel[pen.reason] ?? pen.reason} · Cycle {pen.contribution.cycle.cycleNumber} · {formatDate(pen.appliedAt ?? pen.createdAt)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-amber-700">{formatCurrency(Number(pen.penaltyAmount), currency)}</p>
            <Badge variant={PENALTY_STATUS_VARIANT[pen.status] ?? 'outline'} className="text-xs">
              {pen.status.charAt(0) + pen.status.slice(1).toLowerCase()}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Pay CTA Banner ─────────────────────────────────────────────────────────────

function PayCtaBanner({
  cycleId,
  cycleNumber,
  dueDate,
  contributionAmount,
  currency,
}: {
  cycleId: string;
  cycleNumber: number;
  dueDate: string;
  contributionAmount: number;
  currency: string;
}) {
  const router = useRouter();
  const init = useInitializeContribution();
  const walletPay = useWalletContribute();
  const { data: wallet } = useWallet();
  const [paid, setPaid] = useState(false);

  const walletBalance = Number(wallet?.balance ?? 0);
  const canPayFromWallet = walletBalance >= contributionAmount;
  const isBusy = init.isPending || walletPay.isPending;

  if (paid) return null;

  function handlePaystack() {
    init.mutate(cycleId, {
      onSuccess: ({ authorizationUrl }) => {
        if (process.env.NODE_ENV === 'development' && !authorizationUrl.startsWith('https://checkout.paystack')) {
          router.push('/payments/callback?reference=dev_test');
        } else {
          window.location.href = authorizationUrl;
        }
      },
    });
  }

  function handleWallet() {
    walletPay.mutate(cycleId, { onSuccess: () => setPaid(true) });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-primary px-5 py-4 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">Cycle {cycleNumber} contribution due</p>
        <p className="text-sm opacity-80">
          {new Date(dueDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handlePaystack}
            disabled={isBusy}
            className="bg-white/20 text-white hover:bg-white/30 border-white/30"
          >
            {init.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CreditCard className="size-3.5" />}
            Pay {formatCurrency(contributionAmount, currency)}
          </Button>
          {canPayFromWallet && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleWallet}
              disabled={isBusy}
              className="bg-white/10 text-white hover:bg-white/20 border-white/20"
            >
              {walletPay.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Wallet className="size-3.5" />}
              Wallet
            </Button>
          )}
        </div>
        <p className="text-[11px] opacity-60">🔒 Payments secured by Paystack</p>
      </div>
    </div>
  );
}

// ── Shared primitives ──────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  text,
  subtext,
}: {
  icon: React.ElementType;
  text: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-12 text-center">
      <Icon className="mx-auto mb-2 size-8 text-muted-foreground/40" />
      <p className="text-sm font-medium">{text}</p>
      {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ── Existing sub-components ────────────────────────────────────────────────────

function VirtualAccountCard({ account }: { account: GroupVirtualAccount }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(account.accountNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Group savings account</span>
        </div>
        <span className="text-xs text-muted-foreground">{account.bankName}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-bold tracking-widest">{account.accountNumber}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{account.accountName}</p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={copy}>
          {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Transfer your contribution directly to this account. Payments are automatically reconciled.
      </p>
    </div>
  );
}

function InviteBanner({ groupId }: { groupId: string }) {
  const router = useRouter();
  const accept = useAcceptInvite(groupId);
  const decline = useDeclineInvite(groupId);
  const [error, setError] = useState('');
  const [kycDialogOpen, setKycDialogOpen] = useState(false);
  const busy = accept.isPending || decline.isPending;

  const kycRedirect = encodeURIComponent(`/groups/${groupId}`);

  function handleAccept() {
    setError('');
    accept.mutate(undefined, {
      onSuccess: () => router.refresh(),
      onError: async (err) => {
        if (err instanceof HTTPError) {
          const body: { message?: string } = await err.response.json().catch(() => ({}));
          if (err.response.status === 403 && body.message?.toLowerCase().includes('kyc')) {
            setKycDialogOpen(true);
            return;
          }
          setError(body.message ?? 'Failed to accept. Please try again.');
        } else {
          setError('Failed to accept. Please try again.');
        }
      },
    });
  }

  function handleDecline() {
    setError('');
    decline.mutate(undefined, {
      onSuccess: () => router.push('/groups'),
      onError: () => setError('Failed to decline. Please try again.'),
    });
  }

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
              You need to verify your identity before joining a savings group. This protects
              everyone in the circle and is required for all members.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKycDialogOpen(false)}>Not now</Button>
            <Button asChild>
              <Link href={`/kyc?redirect=${kycRedirect}`}>Verify identity</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {accept.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={handleDecline} disabled={busy}>
              {decline.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
              Decline
            </Button>
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </>
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
    ? new Date(startDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
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
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSave} disabled={update.isPending}>
              Save
            </Button>
            <Button
              size="sm" variant="ghost" className="h-7 px-2 text-xs"
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
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={[
      'flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm',
      highlight ? 'border-green-200 bg-green-50/50' : '',
    ].join(' ')}>
      <span className={[
        'flex size-9 shrink-0 items-center justify-center rounded-lg',
        highlight ? 'bg-green-100' : 'bg-muted',
      ].join(' ')}>
        <Icon className={`size-4 ${highlight ? 'text-green-600' : 'text-muted-foreground'}`} />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-semibold ${highlight ? 'text-green-700' : ''}`}>{value}</p>
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

