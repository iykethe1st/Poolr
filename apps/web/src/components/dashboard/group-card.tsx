import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency, formatFrequency, formatGroupStatus } from '@/lib/format';
import type { GroupWithMembers, ContributionWithGroup } from '@/hooks/use-dashboard';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  OPEN: 'bg-blue-50 text-blue-700',
  ACTIVE: 'bg-green-50 text-green-700',
  COMPLETED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

interface GroupCardProps {
  group: GroupWithMembers;
  userId: string | undefined;
  contributions: ContributionWithGroup[];
}

export function GroupCard({ group, userId, contributions }: GroupCardProps) {
  const myMember = userId ? group.members.find((m) => m.userId === userId) : undefined;
  const activeMembers = group.members.filter((m) => m.memberStatus === 'ACTIVE').length;

  // Find the next pending contribution for this group
  const nextContribution = contributions
    .filter(
      (c) =>
        c.cycle.group.id === group.id &&
        (c.status === 'PENDING' || c.status === 'OVERDUE'),
    )
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0];

  const nextDue = nextContribution
    ? new Date(nextContribution.dueAt).toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
      })
    : null;

  return (
    <Link
      href={`/groups/${group.id}`}
      className="group flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{group.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatCurrency(group.contributionAmount, group.currency)} &nbsp;·&nbsp;{' '}
            {formatFrequency(group.frequency)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              STATUS_STYLES[group.status] ?? 'bg-muted text-muted-foreground',
            )}
          >
            {formatGroupStatus(group.status)}
          </span>
          <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="size-3.5" />
          {activeMembers}/{group.maxMembers}
        </span>
        {myMember && (
          <span>Position #{myMember.rotationPosition}</span>
        )}
        {nextDue && (
          <span
            className={cn(
              'ml-auto font-medium',
              nextContribution?.status === 'OVERDUE' ? 'text-destructive' : 'text-foreground',
            )}
          >
            Due {nextDue}
          </span>
        )}
      </div>
    </Link>
  );
}
