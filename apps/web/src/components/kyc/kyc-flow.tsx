'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Smartphone } from 'lucide-react';
import { getMe, updateProfile, extractHttpError } from '@/lib/kyc-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KycStatus } from './kyc-status';
import { DojahWidget } from './dojah-widget';

type Screen =
  | { type: 'loading' }
  | { type: 'mobile-redirect' }
  | { type: 'name'; userId: string; userEmail: string }
  | { type: 'widget'; userId: string; userEmail: string; fullName: string }
  | { type: 'status'; kycStatus: string; attemptsLeft: number };

const MAX_ATTEMPTS = 3;

function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

const DESCRIPTIONS: Record<string, string> = {
  PENDING: 'Complete the steps below to verify your identity and unlock all Poolr features.',
  VERIFIED: "Your identity has been verified. You're all set to join and create savings circles.",
  UNDER_REVIEW: "Your verification is under review. We'll notify you once it's complete.",
  REJECTED: "Your last verification didn't go through. You can try again below.",
};

function getDescription(screen: Screen): string {
  if (screen.type === 'loading' || screen.type === 'mobile-redirect') return '';
  if (screen.type === 'name' || screen.type === 'widget') return DESCRIPTIONS.PENDING;
  return DESCRIPTIONS[screen.kycStatus] ?? DESCRIPTIONS.PENDING;
}

const nameSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100)
    .regex(/^[a-zA-Z\s'\-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
});

type NameFormValues = z.infer<typeof nameSchema>;

function NameStep({ onDone }: { onDone: (fullName: string) => void }) {
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NameFormValues>({ resolver: zodResolver(nameSchema) });

  async function onSubmit(values: NameFormValues) {
    setServerError('');
    try {
      await updateProfile({ fullName: values.fullName });
      onDone(values.fullName);
    } catch (err) {
      setServerError(await extractHttpError(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Before we verify your identity, we need your legal name exactly as it appears on your government-issued ID.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Legal full name</Label>
        <Input
          id="fullName"
          placeholder="Amara Obi"
          autoComplete="name"
          autoFocus
          {...register('fullName')}
        />
        {errors.fullName && (
          <p className="text-xs text-destructive">{errors.fullName.message}</p>
        )}
      </div>

      {serverError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Continue to verification
      </Button>
    </form>
  );
}

export function KycFlow() {
  const [screen, setScreen] = useState<Screen>({ type: 'loading' });

  const load = useCallback(async () => {
    try {
      const user = await getMe();
      const kyc = user.kycProfile;
      if (!kyc || kyc.kycStatus === 'PENDING') {
        if (!isMobileBrowser()) {
          setScreen({ type: 'mobile-redirect' });
        } else if (!user.fullName) {
          setScreen({ type: 'name', userId: user.id, userEmail: user.email });
        } else {
          setScreen({ type: 'widget', userId: user.id, userEmail: user.email, fullName: user.fullName });
        }
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

  // Called when the user explicitly clicks "Try again" after a rejection.
  // Re-fetches to get the latest fullName, then goes straight to the widget.
  const handleRetry = useCallback(async () => {
    try {
      const user = await getMe();
      if (!isMobileBrowser()) {
        setScreen({ type: 'mobile-redirect' });
      } else if (!user.fullName) {
        setScreen({ type: 'name', userId: user.id, userEmail: user.email });
      } else {
        setScreen({ type: 'widget', userId: user.id, userEmail: user.email, fullName: user.fullName });
      }
    } catch {
      // ignore — user stays on status screen
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

        {screen.type === 'mobile-redirect' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Smartphone className="size-7 text-primary" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-semibold">Verify on the Poolr app</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Identity verification requires a phone camera for the liveness check.
                Open the Poolr app on your phone to complete verification.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Once verified on mobile, your status will update here automatically.
            </p>
          </div>
        )}

        {screen.type === 'name' && (
          <NameStep
            onDone={(fullName) =>
              setScreen({ type: 'widget', userId: screen.userId, userEmail: screen.userEmail, fullName })
            }
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

        {screen.type === 'status' && (
          <KycStatus
            kycStatus={screen.kycStatus}
            message=""
            attemptsLeft={screen.attemptsLeft}
            onRetry={handleRetry}
          />
        )}
      </div>
    </>
  );
}
