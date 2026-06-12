'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMe } from '@/lib/kyc-api';
import { KycStatus } from './kyc-status';
import { DojahWidget } from './dojah-widget';

type Screen =
  | { type: 'loading' }
  | { type: 'widget'; userId: string; userEmail: string; fullName: string }
  | { type: 'status'; kycStatus: string; attemptsLeft: number };

const MAX_ATTEMPTS = 3;

const DESCRIPTIONS: Record<string, string> = {
  PENDING: 'Complete the steps below to verify your identity and unlock all Poolr features.',
  VERIFIED: "Your identity has been verified. You're all set to join and create savings circles.",
  UNDER_REVIEW: "Your verification is under review. We'll notify you once it's complete.",
  REJECTED: "Your last verification didn't go through. You can try again below.",
};

function getDescription(screen: Screen): string {
  if (screen.type === 'loading') return '';
  if (screen.type === 'widget') return DESCRIPTIONS.PENDING;
  return DESCRIPTIONS[screen.kycStatus] ?? DESCRIPTIONS.PENDING;
}

export function KycFlow() {
  const [screen, setScreen] = useState<Screen>({ type: 'loading' });

  const load = useCallback(async () => {
    try {
      const user = await getMe();
      const kyc = user.kycProfile;
      if (!kyc || kyc.kycStatus === 'PENDING') {
        setScreen({
          type: 'widget',
          userId: user.id,
          userEmail: user.email,
          fullName: user.fullName,
        });
      } else {
        setScreen({
          type: 'status',
          kycStatus: kyc.kycStatus,
          attemptsLeft: Math.max(0, MAX_ATTEMPTS - (kyc.kycAttempts ?? 0)),
        });
      }
    } catch {
      setScreen({ type: 'loading' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const description = getDescription(screen);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Identity verification</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        {screen.type === 'loading' && (
          <div className="flex h-48 items-center justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          </div>
        )}

        {screen.type === 'status' && (
          <KycStatus
            kycStatus={screen.kycStatus}
            message=""
            attemptsLeft={screen.attemptsLeft}
            onRetry={load}
          />
        )}

        {screen.type === 'widget' && (
          <DojahWidget
            userId={screen.userId}
            userEmail={screen.userEmail}
            fullName={screen.fullName}
            onComplete={load}
          />
        )}
      </div>
    </>
  );
}
