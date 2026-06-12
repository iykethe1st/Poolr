'use client';

import Link from 'next/link';
import { AlertTriangle, CircleDollarSign, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-shell';
import { StatCard } from './stat-card';
import { GroupsList } from './groups-list';
import { UpcomingContributions } from './upcoming-contributions';
import { RecentActivity } from './recent-activity';
import {
  useCurrentUser,
  useWallet,
  useGroups,
  useContributions,
  useNotifications,
} from '@/hooks/use-dashboard';
import { formatCurrency } from '@/lib/format';

export function DashboardContent() {
  const { data: user } = useCurrentUser();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: groups, isLoading: groupsLoading } = useGroups();
  const { data: contributions, isLoading: contribLoading } = useContributions();
  const { data: notifications, isLoading: notifLoading } = useNotifications();

  const greeting = user
    ? `Welcome back, ${user.fullName.split(' ')[0]}!`
    : 'Welcome back!';

  const activeGroups = groups?.filter((g) => {
    const myMember = g.members.find((m) => m.userId === user?.id);
    // Exclude groups where I'm only invited (not yet accepted)
    if (myMember?.memberStatus === 'INVITED') return false;
    return ['DRAFT', 'OPEN', 'ACTIVE'].includes(g.status);
  }).length ?? 0;

  const pendingCount = contributions?.filter(
    (c) => c.status === 'PENDING' || c.status === 'OVERDUE',
  ).length ?? 0;

  const overdueCount = contributions?.filter((c) => c.status === 'OVERDUE').length ?? 0;

  const kycVerified = user?.kycProfile?.kycStatus === 'VERIFIED';

  return (
    <div className="space-y-6">
      <PageHeader title={greeting} description="Here's an overview of your savings.">
        {!kycVerified && user && (
          <Button size="sm" variant="outline" asChild>
            <Link href="/kyc">
              <ShieldCheck className="size-3.5" />
              Identity verification
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* ── Overdue banner ──────────────────────────────────────────────────── */}
      {!contribLoading && overdueCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-destructive">
              {overdueCount} overdue {overdueCount === 1 ? 'payment' : 'payments'}
            </span>
            <span className="text-muted-foreground">
              {' '}— pay now to avoid penalties.
            </span>
          </div>
        </div>
      )}

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Wallet balance"
          value={wallet ? formatCurrency(wallet.balance, wallet.currency) : '—'}
          subtext={walletLoading ? undefined : wallet?.currency}
          icon={CircleDollarSign}
          loading={walletLoading}
        />
        <StatCard
          label="Active groups"
          value={groupsLoading ? '—' : String(activeGroups)}
          subtext={activeGroups === 1 ? '1 group' : `${activeGroups} groups`}
          icon={Users}
          loading={groupsLoading}
        />
        <StatCard
          label="Upcoming payments"
          value={contribLoading ? '—' : String(pendingCount)}
          subtext={overdueCount > 0 ? `${overdueCount} overdue` : 'All on track'}
          icon={TrendingUp}
          iconClassName={overdueCount > 0 ? 'bg-destructive/10 text-destructive' : undefined}
          loading={contribLoading}
        />
        <StatCard
          label="Unread notifications"
          value={notifLoading ? '—' : String(notifications?.unreadCount ?? 0)}
          subtext="In last 30 days"
          loading={notifLoading}
        />
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GroupsList
            groups={groups}
            contributions={contributions ?? []}
            userId={user?.id}
            loading={groupsLoading}
          />
        </div>
        <div>
          <UpcomingContributions
            contributions={contributions}
            loading={contribLoading}
          />
        </div>
      </div>

      {/* ── Activity feed ───────────────────────────────────────────────────── */}
      <RecentActivity notifications={notifications} loading={notifLoading} />
    </div>
  );
}
