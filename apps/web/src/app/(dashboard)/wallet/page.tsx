import type { Metadata } from 'next';
import { WalletContent } from '@/components/wallet/wallet-content';
import { PageShell } from '@/components/layout/page-shell';

export const metadata: Metadata = { title: 'Wallet' };

export default function WalletPage() {
  return (
    <PageShell>
      <WalletContent />
    </PageShell>
  );
}
