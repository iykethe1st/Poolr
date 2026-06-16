import { PageHeader } from '@/components/layout/page-shell';
import { BankAccountSection } from '@/components/settings/bank-account-form';

export const metadata = { title: 'Settings — Poolr' };

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your account preferences and payout details"
      />

      <section className="space-y-3 max-w-lg">
        <div>
          <h2 className="text-sm font-semibold">Payout account</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The bank account where your group payouts will be sent. Must be in your name.
          </p>
        </div>
        <BankAccountSection />
      </section>
    </div>
  );
}
