import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupCard } from './group-card';
import type { GroupWithMembers, ContributionWithGroup } from '@/hooks/use-dashboard';

interface GroupsListProps {
  groups: GroupWithMembers[] | undefined;
  contributions: ContributionWithGroup[];
  userId: string | undefined;
  loading: boolean;
}

export function GroupsList({ groups, contributions, userId, loading }: GroupsListProps) {
  return (
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
          {[1, 2, 3].map((i) => (
            <GroupSkeleton key={i} />
          ))}
        </div>
      ) : !groups?.length ? (
        <EmptyGroups />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
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
