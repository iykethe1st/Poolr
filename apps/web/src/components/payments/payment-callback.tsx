'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVerifyPayment } from '@/hooks/use-payments';
import { useVerifyTopUp } from '@/hooks/use-wallet';

export function PaymentCallback() {
  const searchParams = useSearchParams();
  // Paystack sends both ?reference= and ?trxref= — check both
  const reference = searchParams.get('reference') ?? searchParams.get('trxref');

  if (!reference) {
    return <InvalidCallback />;
  }

  if (reference.startsWith('topup_')) {
    return <VerifyTopUpState reference={reference} />;
  }

  return <VerifyState reference={reference} />;
}

function VerifyState({ reference }: { reference: string }) {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isFetching } = useVerifyPayment(reference);

  // Auto-redirect to dashboard after a short delay on success
  useEffect(() => {
    if (data?.status === 'success') {
      const t = setTimeout(() => router.push('/dashboard'), 5000);
      return () => clearTimeout(t);
    }
  }, [data?.status, router]);

  if (isLoading || isFetching) {
    return (
      <CallbackShell>
        <Loader2 className="size-12 animate-spin text-muted-foreground" />
        <p className="mt-4 text-lg font-semibold">Verifying payment&hellip;</p>
        <p className="text-sm text-muted-foreground">
          Please wait while we confirm your payment with Paystack.
        </p>
      </CallbackShell>
    );
  }

  if (isError) {
    return (
      <CallbackShell>
        <AlertCircle className="size-12 text-destructive" />
        <p className="mt-4 text-lg font-semibold">Verification failed</p>
        <p className="text-sm text-muted-foreground">
          We could not reach our payment server. Please check your dashboard for the
          latest contribution status.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </CallbackShell>
    );
  }

  const status = data?.status;

  if (status === 'success') {
    return (
      <CallbackShell>
        <CheckCircle2 className="size-12 text-emerald-500" />
        <p className="mt-4 text-lg font-semibold">Payment successful!</p>
        {data?.amount !== undefined && (
          <p className="text-2xl font-bold">
            ₦{data.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </p>
        )}
        {data?.groupName && (
          <p className="text-sm text-muted-foreground">
            Contribution to <span className="font-semibold text-foreground">{data.groupName}</span> confirmed.
          </p>
        )}
        {!data?.groupName && (
          <p className="text-sm text-muted-foreground">
            Your contribution has been confirmed. You&apos;ll be redirected in a moment.
          </p>
        )}
        <div className="mt-6 flex gap-3">
          {data?.groupId && (
            <Button asChild>
              <Link href={`/groups/${data.groupId}`}>Back to group</Link>
            </Button>
          )}
          <Button asChild variant={data?.groupId ? 'outline' : 'default'}>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </CallbackShell>
    );
  }

  if (status === 'pending') {
    return (
      <CallbackShell>
        <Clock className="size-12 text-amber-500" />
        <p className="mt-4 text-lg font-semibold">Payment pending</p>
        <p className="text-sm text-muted-foreground">
          Your payment is still being processed. Check back in a moment.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Check status
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </CallbackShell>
    );
  }

  // failed | abandoned
  return (
    <CallbackShell>
      <AlertCircle className="size-12 text-destructive" />
      <p className="mt-4 text-lg font-semibold">Payment {status ?? 'failed'}</p>
      <p className="text-sm text-muted-foreground">
        Your payment was not completed.{' '}
        {status === 'abandoned'
          ? 'You left the checkout before completing the payment.'
          : 'There was a problem processing your payment.'}
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild variant="outline">
          <Link href="/dashboard">
            <RotateCcw className="size-4" />
            Try again
          </Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </CallbackShell>
  );
}

function VerifyTopUpState({ reference }: { reference: string }) {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isFetching } = useVerifyTopUp(reference);

  useEffect(() => {
    if (data?.status === 'success') {
      const t = setTimeout(() => router.push('/wallet'), 4000);
      return () => clearTimeout(t);
    }
  }, [data?.status, router]);

  if (isLoading || isFetching) {
    return (
      <CallbackShell>
        <Loader2 className="size-12 animate-spin text-muted-foreground" />
        <p className="mt-4 text-lg font-semibold">Verifying top-up&hellip;</p>
        <p className="text-sm text-muted-foreground">Please wait while we confirm your payment.</p>
      </CallbackShell>
    );
  }

  if (isError) {
    return (
      <CallbackShell>
        <AlertCircle className="size-12 text-destructive" />
        <p className="mt-4 text-lg font-semibold">Verification failed</p>
        <p className="text-sm text-muted-foreground">Could not confirm your top-up. Check your wallet for the latest balance.</p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
          <Button asChild><Link href="/wallet">Go to wallet</Link></Button>
        </div>
      </CallbackShell>
    );
  }

  if (data?.status === 'success') {
    return (
      <CallbackShell>
        <CheckCircle2 className="size-12 text-emerald-500" />
        <p className="mt-4 text-lg font-semibold">Top-up successful!</p>
        <p className="text-sm text-muted-foreground">
          Your wallet has been credited. You&apos;ll be redirected shortly.
        </p>
        <Button className="mt-6" asChild><Link href="/wallet">Go to wallet</Link></Button>
      </CallbackShell>
    );
  }

  return (
    <CallbackShell>
      <AlertCircle className="size-12 text-destructive" />
      <p className="mt-4 text-lg font-semibold">Top-up {data?.status ?? 'failed'}</p>
      <p className="text-sm text-muted-foreground">Your top-up was not completed.</p>
      <div className="mt-6 flex gap-3">
        <Button asChild variant="outline"><Link href="/wallet">Try again</Link></Button>
        <Button asChild><Link href="/dashboard">Dashboard</Link></Button>
      </div>
    </CallbackShell>
  );
}

function CallbackShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}

function InvalidCallback() {
  return (
    <CallbackShell>
      <AlertCircle className="size-12 text-muted-foreground" />
      <p className="mt-4 text-lg font-semibold">Invalid callback</p>
      <p className="text-sm text-muted-foreground">
        No payment reference found in this URL.
      </p>
      <Button className="mt-6" asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </CallbackShell>
  );
}
