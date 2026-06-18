import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { KycFlow } from '@/components/kyc/kyc-flow';

export const metadata: Metadata = { title: 'Identity verification' };

export default function KycPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-lg">
        <KycFlow />
      </div>
    </PageShell>
  );
}
