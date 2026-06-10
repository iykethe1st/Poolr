import type { Metadata } from 'next';
import { KycFlow } from '@/components/kyc/kyc-flow';

export const metadata: Metadata = { title: 'Identity verification' };

export default function KycPage() {
  return (
    <div className="mx-auto max-w-lg py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Identity verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete KYC to unlock all Poolr features. Your data is encrypted and handled
          in accordance with our privacy policy.
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <KycFlow />
      </div>
    </div>
  );
}
