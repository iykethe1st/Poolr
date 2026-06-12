import type { Metadata } from 'next';
import { KycFlow } from '@/components/kyc/kyc-flow';

export const metadata: Metadata = { title: 'Identity verification' };

export default function KycPage() {
  return (
    <div className="mx-auto max-w-lg py-8">
      <KycFlow />
    </div>
  );
}
