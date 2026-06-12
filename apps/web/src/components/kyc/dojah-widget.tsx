'use client';

import { useState } from 'react';
import Script from 'next/script';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';

declare global {
  interface Window {
    Connect: new (options: DojahConnectOptions) => DojahConnect;
  }
}

interface DojahConnect {
  setup(): void;
  open(): void;
}

interface DojahConnectOptions {
  app_id: string;
  p_key: string;
  type: string;
  user_data?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    residence_country?: string;
  };
  metadata?: Record<string, string>;
  onSuccess?: (response: Record<string, unknown>) => void;
  onError?: (err: unknown) => void;
  onClose?: () => void;
}

interface Props {
  userId: string;
  userEmail: string;
  fullName: string;
  onComplete: () => void;
}

export function DojahWidget({ userId, userEmail, fullName, onComplete }: Props) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const [firstName, ...rest] = fullName.trim().split(' ');
  const lastName = rest.join(' ') || firstName;

  function openWidget() {
    if (!window.Connect) return;

    const connect = new window.Connect({
      app_id: process.env.NEXT_PUBLIC_DOJAH_APP_ID ?? '',
      p_key: process.env.NEXT_PUBLIC_DOJAH_PUBLIC_KEY ?? '',
      type: 'verification',
      user_data: {
        first_name: firstName,
        last_name: lastName,
        email: userEmail,
        residence_country: 'NG',
      },
      metadata: { user_id: userId },
      onSuccess: async (response) => {
        console.log('[Dojah] onSuccess payload:', JSON.stringify(response, null, 2));

        // Dojah may use snake_case or camelCase depending on SDK version
        const entity = response.entity as Record<string, unknown> | undefined;
        const referenceId =
          (response.reference_id as string) ||
          (response.referenceId as string) ||
          (entity?.reference_id as string) ||
          (entity?.referenceId as string);

        if (!referenceId) {
          console.error('[Dojah] No reference_id in response:', response);
          setError('Verification completed but no reference was returned. Please try again.');
          return;
        }

        setVerifying(true);
        setError('');
        try {
          await apiClient.post('users/kyc/verify', {
            json: { referenceId },
          });
          onComplete();
        } catch {
          setError('Verification submitted but confirmation failed. Please refresh the page.');
          setVerifying(false);
        }
      },
      onError: () => {
        setError('Verification failed. Please try again.');
      },
      onClose: () => {},
    });

    connect.setup();
    connect.open();
  }

  if (verifying) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Confirming your verification…</p>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://widget.dojah.io/widget.js"
        onLoad={() => setScriptLoaded(true)}
      />

      <div className="space-y-4">
        <div className="rounded-xl border bg-muted/40 p-4 text-sm">
          <p className="font-medium">What to expect</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>• Enter your BVN or NIN for identity lookup</li>
            <li>• Take a selfie for liveness verification</li>
            <li>• Upload a government-issued photo ID</li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Your data is processed securely and never stored on Poolr servers.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button className="w-full" onClick={openWidget} disabled={!scriptLoaded}>
          {!scriptLoaded ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </>
          ) : (
            <>
              <ShieldCheck className="size-4" />
              Start identity verification
            </>
          )}
        </Button>
      </div>
    </>
  );
}
