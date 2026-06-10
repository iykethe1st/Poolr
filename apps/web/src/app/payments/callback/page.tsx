import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { PaymentCallback } from '@/components/payments/payment-callback';

export const metadata: Metadata = { title: 'Payment' };

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PaymentCallback />
    </Suspense>
  );
}
