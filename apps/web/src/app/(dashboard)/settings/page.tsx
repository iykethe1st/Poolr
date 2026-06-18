import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BankAccountSection } from '@/components/settings/bank-account-form';

import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Settings — Poolr' };

export default function SettingsPage() {
  return (
    <PageShell>
      <div className="space-y-8">
        <PageHeader
          title="Settings"
          description="Manage your account preferences and payout details"
        />

        <section className="space-y-3 max-w-lg">
          <div>
            <h2 className="text-sm font-semibold">Withdrawal account</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The bank account your wallet withdrawals will be sent to. Must be in your name.
            </p>
          </div>
          <BankAccountSection />
        </section>
      </div>
    </PageShell>
  );
}
