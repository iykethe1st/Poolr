'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getMe } from '@/lib/kyc-api';

type KycStatusValue = 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';

const CONFIG: Record<
  KycStatusValue,
  { icon: React.ReactNode; title: string; colour: string; bgColour: string }
> = {
  PENDING: {
    icon: <Clock className="size-8" />,
    title: 'Verification pending',
    colour: 'text-muted-foreground',
    bgColour: 'bg-muted',
  },
  UNDER_REVIEW: {
    icon: <Clock className="size-8 text-amber-600" />,
    title: 'Under review',
    colour: 'text-amber-700',
    bgColour: 'bg-amber-50',
  },
  VERIFIED: {
    icon: <CheckCircle2 className="size-8 text-green-600" />,
    title: 'Identity verified',
    colour: 'text-green-700',
    bgColour: 'bg-green-50',
  },
  REJECTED: {
    icon: <XCircle className="size-8 text-destructive" />,
    title: 'Verification failed',
    colour: 'text-destructive',
    bgColour: 'bg-destructive/10',
  },
};

export function KycStatus({
  kycStatus,
  message,
  attemptsLeft,
  onRetry,
}: {
  kycStatus: string;
  message: string;
  attemptsLeft: number;
  onRetry: () => void;
}) {
  const status = (kycStatus as KycStatusValue) in CONFIG
    ? (kycStatus as KycStatusValue)
    : 'PENDING';
  const cfg = CONFIG[status];

  // Poll while UNDER_REVIEW — server processes asynchronously in some cases
  const [polledStatus, setPolledStatus] = useState<KycStatusValue>(status);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (polledStatus !== 'UNDER_REVIEW') return;
    intervalRef.current = setInterval(async () => {
      try {
        const user = await getMe();
        const s = user.kycProfile?.kycStatus as KycStatusValue | undefined;
        if (s && s !== 'UNDER_REVIEW') {
          setPolledStatus(s);
          clearInterval(intervalRef.current!);
        }
      } catch {
        // ignore poll errors
      }
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [polledStatus]);

  const displayStatus = polledStatus;
  const displayCfg = CONFIG[displayStatus];

  return (
    <div className="space-y-6 text-center">
      <div
        className={cn(
          'mx-auto flex size-20 items-center justify-center rounded-full',
          displayCfg.bgColour,
        )}
      >
        {displayCfg.icon}
      </div>

      <div>
        <h2 className={cn('text-xl font-bold', displayCfg.colour)}>{displayCfg.title}</h2>
        {message && (
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        )}
      </div>

      {displayStatus === 'UNDER_REVIEW' && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" />
          Checking status…
        </div>
      )}

      {displayStatus === 'VERIFIED' && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            You can now join and create savings circles.
          </p>
          <Button asChild className="w-full">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      )}

      {displayStatus === 'REJECTED' && (
        <div className="space-y-3">
          {attemptsLeft > 0 ? (
            <>
              <div className="rounded-lg bg-destructive/5 px-4 py-3 text-sm">
                <p className="font-medium text-destructive">Verification failed</p>
                <p className="mt-1 text-muted-foreground">
                  This can happen if details don&apos;t exactly match your ID records. You
                  have <strong>{attemptsLeft}</strong> attempt{attemptsLeft !== 1 ? 's' : ''} remaining.
                </p>
              </div>
              <Button onClick={onRetry} className="w-full">
                Try again
              </Button>
            </>
          ) : (
            <div className="rounded-lg bg-destructive/5 px-4 py-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Maximum attempts reached</p>
                  <p className="mt-1 text-muted-foreground">
                    Please contact{' '}
                    <a
                      href="mailto:support@poolr.ng"
                      className="underline underline-offset-4"
                    >
                      support@poolr.ng
                    </a>{' '}
                    for manual verification.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
