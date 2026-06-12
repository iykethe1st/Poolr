'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { HTTPError } from 'ky';
import { Loader2, ShieldAlert, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isAuthenticated } from '@/lib/auth';
import { useGroup, useJoinGroup, useDeclineInvite } from '@/hooks/use-group';
import { useCurrentUser } from '@/hooks/use-dashboard';
import { formatCurrency, formatFrequency } from '@/lib/format';

interface Props {
  groupId: string;
}

export function JoinPageContent({ groupId }: Props) {
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  useEffect(() => {
    setAuthed(isAuthenticated());
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authed) {
    return <GuestView groupId={groupId} token={token} />;
  }

  return <AuthedView groupId={groupId} token={token} />;
}

function GuestView({ groupId, token }: { groupId: string; token: string }) {
  const returnUrl = `/groups/${groupId}/join${token ? `?token=${token}` : ''}`;
  const encoded = encodeURIComponent(returnUrl);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-2xl font-bold tracking-tight">Poolr</span>
          <p className="mt-1 text-sm text-muted-foreground">
            Rotating savings circles, reimagined.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="mb-6 space-y-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Users className="size-7 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">You&apos;ve been invited!</h1>
            <p className="text-sm text-muted-foreground">
              Someone invited you to join a savings circle on Poolr. Create an account or sign in
              to accept your invitation.
            </p>
          </div>

          <div className="space-y-3">
            <Button className="w-full" asChild>
              <Link href={`/register?redirect=${encoded}`}>Create account</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/login?redirect=${encoded}`}>Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthedView({ groupId, token }: { groupId: string; token: string }) {
  const router = useRouter();
  const { data: group, isLoading: groupLoading, isError: groupError } = useGroup(groupId);
  const { data: me } = useCurrentUser();
  const joinGroup = useJoinGroup(groupId);
  const declineInvite = useDeclineInvite(groupId);
  const [error, setError] = useState('');
  const [kycRequired, setKycRequired] = useState(false);

  const myMember = group?.members.find((m) => m.userId === me?.id);
  const isInvited = myMember?.memberStatus === 'INVITED';
  const isActive = myMember?.memberStatus === 'ACTIVE';

  useEffect(() => {
    if (isActive) {
      router.replace(`/groups/${groupId}`);
    }
  }, [isActive, groupId, router]);

  async function handleAccept() {
    setError('');
    setKycRequired(false);
    try {
      await joinGroup.mutateAsync(token);
      router.push(`/groups/${groupId}`);
      router.refresh();
    } catch (err) {
      if (err instanceof HTTPError) {
        const body = await err.response.json<{ message?: string }>().catch(() => ({} as { message?: string }));
        if (err.response.status === 403 && body.message?.toLowerCase().includes('kyc')) {
          setKycRequired(true);
        } else {
          setError(body.message ?? 'Failed to accept. The invite link may have expired.');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  }

  async function handleDecline() {
    setError('');
    try {
      await declineInvite.mutateAsync();
      router.push('/groups');
    } catch (err) {
      if (err instanceof HTTPError) {
        const body = await err.response.json<{ message?: string }>().catch(() => ({} as { message?: string }));
        setError(body.message ?? 'Failed to decline invitation.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  }

  if (groupLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (groupError || !group) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm text-center space-y-4">
          <h1 className="text-xl font-semibold">Invite not found</h1>
          <p className="text-sm text-muted-foreground">
            This invite link is invalid, has expired, or isn&apos;t associated with your account.
          </p>
          <Button variant="outline" asChild>
            <Link href="/groups">View my groups</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!isInvited && !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm text-center space-y-4">
          <h1 className="text-xl font-semibold">No pending invite</h1>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have a pending invitation for this group.
          </p>
          <Button variant="outline" asChild>
            <Link href={`/groups/${groupId}`}>View group</Link>
          </Button>
        </div>
      </div>
    );
  }

  const busy = joinGroup.isPending || declineInvite.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-2xl font-bold tracking-tight">Poolr</span>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Users className="size-7 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">{group.name}</h1>
            <p className="text-sm text-muted-foreground">
              {formatFrequency(group.frequency)} &nbsp;·&nbsp;{' '}
              {formatCurrency(group.contributionAmount, group.currency)} per member
            </p>
            <p className="text-sm">You&apos;ve been invited to join this savings circle.</p>
          </div>

          {kycRequired && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Identity verification is required to join.{' '}
                <Link
                  href={`/kyc?redirect=${encodeURIComponent(`/groups/${groupId}/join${token ? `?token=${token}` : ''}`)}`}
                  className="font-medium underline underline-offset-4"
                >
                  Verify now
                </Link>
              </span>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-3">
            {kycRequired ? (
              <Button className="w-full" asChild>
                <Link
                  href={`/kyc?redirect=${encodeURIComponent(`/groups/${groupId}/join${token ? `?token=${token}` : ''}`)}`}
                >
                  Complete verification
                </Link>
              </Button>
            ) : (
              <Button className="w-full" onClick={handleAccept} disabled={busy}>
                {joinGroup.isPending && <Loader2 className="size-4 animate-spin" />}
                Accept invitation
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={handleDecline} disabled={busy}>
              {declineInvite.isPending && <Loader2 className="size-4 animate-spin" />}
              Decline
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
