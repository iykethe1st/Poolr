'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HTTPError } from 'ky';
import { ArrowLeft, HandCoins, Loader2, Trash2, UserCircle2, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-shell';
import {
  useGroup,
  useRemoveMember,
  useDeleteGroup,
  useUpdateMySlots,
  useOfferSlot,
  useAcceptInvite,
  useDeclineInvite,
  type GroupMember,
} from '@/hooks/use-group';
import { useCurrentUser } from '@/hooks/use-dashboard';
import { cn } from '@/lib/utils';

interface MembersContentProps {
  groupId: string;
}

const MEMBER_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'destructive'> = {
  ACTIVE: 'success',
  INVITED: 'warning',
  LEFT: 'outline',
  REMOVED: 'destructive',
};

const SLOT_OPTIONS = [1, 2, 3] as const;

export function MembersContent({ groupId }: MembersContentProps) {
  const { data: group, isLoading } = useGroup(groupId);
  const { data: me } = useCurrentUser();

  if (isLoading) return <MembersSkeleton />;
  if (!group) return <p className="text-sm text-muted-foreground">Group not found.</p>;

  const isAdmin = me?.id === group.adminId;
  const isDraft = group.status === 'DRAFT';
  const canDelete = isAdmin && group.status !== 'ACTIVE';

  // Deduplicate by userId — each entry tracks all slot rows
  const uniqueMembers = useMemo(() => {
    const map = new Map<string, { primary: GroupMember; slots: number; hasOffer: boolean }>();
    for (const m of group.members) {
      const existing = map.get(m.userId);
      if (existing) {
        existing.slots += 1;
        if (m.memberStatus === 'INVITED') existing.hasOffer = true;
      } else {
        map.set(m.userId, {
          primary: m,
          slots: 1,
          hasOffer: m.memberStatus === 'INVITED',
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => a.primary.rotationPosition - b.primary.rotationPosition,
    );
  }, [group.members]);

  const mySlots = uniqueMembers.find((e) => e.primary.userId === me?.id)?.slots ?? 1;
  const myHasOffer = uniqueMembers.find((e) => e.primary.userId === me?.id)?.hasOffer ?? false;

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
        description={`${group.name} · ${uniqueMembers.filter((e) => e.primary.memberStatus === 'ACTIVE').length} active`}
      >
        {isAdmin && isDraft && group.members.filter(m => ['ACTIVE','INVITED'].includes(m.memberStatus)).length < group.maxMembers && (
          <Button size="sm" asChild>
            <Link href={`/groups/${groupId}/invite`}>
              <UserPlus className="size-3.5" />
              Invite member
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* Admin self-slot control */}
      {isAdmin && isDraft && (
        <AdminSlotCard groupId={groupId} currentSlots={mySlots} maxMembers={group.maxMembers} totalSlots={group.members.filter(m => ['ACTIVE','INVITED'].includes(m.memberStatus)).length} />
      )}

      {/* Pending slot offer for non-admin members */}
      {!isAdmin && myHasOffer && isDraft && (
        <SlotOfferBanner groupId={groupId} />
      )}

      {canDelete && <DeleteGroupCard groupId={groupId} groupName={group.name} />}

      <div className="rounded-xl border bg-card shadow-sm divide-y">
        {uniqueMembers.length === 0 ? (
          <div className="py-10 text-center">
            <UserCircle2 className="mx-auto mb-2 size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No members yet</p>
          </div>
        ) : (
          uniqueMembers.map(({ primary: member, slots, hasOffer }) => (
            <MemberRow
              key={member.userId}
              member={member}
              slots={slots}
              hasOffer={hasOffer}
              groupId={groupId}
              groupStatus={group.status}
              isAdmin={isAdmin}
              isDraft={isDraft}
              currentUserId={me?.id}
              adminId={group.adminId}
              totalSlots={group.members.filter(m => ['ACTIVE','INVITED'].includes(m.memberStatus)).length}
              maxMembers={group.maxMembers}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AdminSlotCard({
  groupId,
  currentSlots,
  maxMembers,
  totalSlots,
}: {
  groupId: string;
  currentSlots: number;
  maxMembers: number;
  totalSlots: number;
}) {
  const update = useUpdateMySlots(groupId);
  const [error, setError] = useState('');
  const availableAfterMe = (n: number) => totalSlots - currentSlots + n <= maxMembers;

  async function handleSelect(n: number) {
    if (n === currentSlots) return;
    setError('');
    update.mutate(n, {
      onError: async (err) => {
        if (err instanceof HTTPError) {
          const body: { message?: string } = await err.response.json().catch(() => ({}));
          setError(body.message ?? 'Failed to update slots.');
        } else {
          setError('Failed to update slots.');
        }
      },
    });
  }

  return (
    <div className="rounded-xl border bg-card px-4 py-4 shadow-sm space-y-3">
      <div>
        <p className="text-sm font-semibold">Your slots</p>
        <p className="text-xs text-muted-foreground">
          Reserve multiple positions in the rotation for yourself.
        </p>
      </div>
      <div className="flex gap-2">
        {SLOT_OPTIONS.map((n) => {
          const disabled = !availableAfterMe(n) || update.isPending;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(n)}
              className={cn(
                'flex h-10 w-14 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-all',
                n === currentSlots
                  ? 'border-primary bg-primary text-primary-foreground'
                  : disabled
                  ? 'cursor-not-allowed border-border opacity-40'
                  : 'border-border hover:border-primary/60 hover:bg-primary/5',
              )}
            >
              {update.isPending && n === currentSlots ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                n
              )}
            </button>
          );
        })}
        <p className="ml-2 self-center text-xs text-muted-foreground">
          {maxMembers - totalSlots + currentSlots} slot{maxMembers - totalSlots + currentSlots !== 1 ? 's' : ''} still open
        </p>
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <span className="font-medium">⚠</span> {error}
        </p>
      )}
    </div>
  );
}

function SlotOfferBanner({ groupId }: { groupId: string }) {
  const accept = useAcceptInvite(groupId);
  const decline = useDeclineInvite(groupId);
  const busy = accept.isPending || decline.isPending;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <HandCoins className="size-4 text-primary" />
          </span>
          <div>
            <p className="text-sm font-medium">You&apos;ve been offered an extra slot</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The group admin is offering you an additional position in the rotation.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={() => accept.mutate(1)} disabled={busy}>
            {accept.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={() => decline.mutate()} disabled={busy}>
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  slots,
  hasOffer,
  groupId,
  groupStatus,
  isAdmin,
  isDraft,
  currentUserId,
  adminId,
  totalSlots,
  maxMembers,
}: {
  member: GroupMember;
  slots: number;
  hasOffer: boolean;
  groupId: string;
  groupStatus: string;
  isAdmin: boolean;
  isDraft: boolean;
  currentUserId?: string;
  adminId: string;
  totalSlots: number;
  maxMembers: number;
}) {
  const removeMember = useRemoveMember(groupId);
  const offerSlot = useOfferSlot(groupId);
  const [offerError, setOfferError] = useState('');
  const isMe = member.userId === currentUserId;
  const isMemberAdmin = member.userId === adminId;
  const canRemove = isAdmin && !isMe && !isMemberAdmin && groupStatus !== 'ACTIVE';
  const canOffer =
    isAdmin && isDraft && !isMe && !hasOffer && totalSlots < maxMembers && slots < 3;

  async function handleOffer() {
    setOfferError('');
    offerSlot.mutate(member.userId, {
      onError: async (err) => {
        if (err instanceof HTTPError) {
          const body: { message?: string } = await err.response.json().catch(() => ({}));
          setOfferError(body.message ?? 'Failed to offer slot.');
        } else {
          setOfferError('Failed to offer slot.');
        }
      },
    });
  }

  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {member.rotationPosition}
        </span>

        <UserCircle2 className="size-8 shrink-0 text-muted-foreground/50" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="truncate text-sm font-medium">{member.user.fullName}</p>
            {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
            {isMemberAdmin && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                Admin
              </span>
            )}
            {slots > 1 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                <HandCoins className="size-2.5" />
                {slots} slots
              </span>
            )}
            {hasOffer && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                offer pending
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{member.user.phone}</p>
          <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={MEMBER_STATUS_VARIANT[member.memberStatus] ?? 'outline'}>
            {member.memberStatus === 'INVITED' ? 'Invited' : 'Active'}
          </Badge>

          {canOffer && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={handleOffer}
              disabled={offerSlot.isPending}
            >
              {offerSlot.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <HandCoins className="size-3" />
              )}
              Offer slot
            </Button>
          )}

          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (!confirm(`Remove ${member.user.fullName} from this group?`)) return;
                removeMember.mutate(member.id);
              }}
              disabled={removeMember.isPending}
              title="Remove member"
            >
              {removeMember.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>
      {offerError && (
        <p className="ml-9 text-xs text-destructive">{offerError}</p>
      )}
    </div>
  );
}

function DeleteGroupCard({ groupId, groupName }: { groupId: string; groupName: string }) {
  const deleteGroup = useDeleteGroup(groupId);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Delete "${groupName}"? The group will be removed from all members' views. All records are preserved.`)) return;
    setError('');
    deleteGroup.mutate(undefined, {
      onSuccess: () => router.push('/groups'),
      onError: async (err) => {
        if (err instanceof HTTPError) {
          const body: { message?: string } = await err.response.json().catch(() => ({}));
          setError(body.message ?? 'Failed to delete group.');
        } else {
          setError('Failed to delete group.');
        }
      },
    });
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-destructive">Danger zone</p>
          <p className="text-xs text-muted-foreground">Deleting the group is irreversible from members&apos; perspective. All records are kept.</p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="shrink-0"
          onClick={handleDelete}
          disabled={deleteGroup.isPending}
        >
          {deleteGroup.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          Delete group
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
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
