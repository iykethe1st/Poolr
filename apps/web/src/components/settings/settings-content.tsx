'use client';

import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck, ShieldX, ShieldAlert, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BankAccountSection } from '@/components/settings/bank-account-form';
import { PageHeader } from '@/components/layout/page-shell';
import { useCurrentUser } from '@/hooks/use-dashboard';
import { clearToken } from '@/lib/auth';

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const KYC_CONFIG = {
  VERIFIED: {
    label: '✓ Verified',
    variant: 'success' as const,
    Icon: ShieldCheck,
    iconClass: 'text-emerald-600',
  },
  PENDING: {
    label: 'Pending',
    variant: 'warning' as const,
    Icon: ShieldAlert,
    iconClass: 'text-amber-600',
  },
  UNVERIFIED: {
    label: 'Unverified',
    variant: 'destructive' as const,
    Icon: ShieldX,
    iconClass: 'text-destructive',
  },
  FAILED: {
    label: 'Failed',
    variant: 'destructive' as const,
    Icon: ShieldX,
    iconClass: 'text-destructive',
  },
};

export function SettingsContent() {
  const router = useRouter();
  const { data: me } = useCurrentUser();

  const kycStatus = me?.kycProfile?.kycStatus ?? 'UNVERIFIED';
  const kyc = KYC_CONFIG[kycStatus as keyof typeof KYC_CONFIG] ?? KYC_CONFIG.UNVERIFIED;

  function handleSignOut() {
    clearToken();
    router.push('/login');
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your account preferences and payout details"
      />

      {/* Profile card */}
      <section className="max-w-lg">
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-5">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-semibold">
            {me ? initials(me.fullName) : '—'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{me?.fullName ?? '—'}</p>
            <p className="text-sm text-muted-foreground truncate">{me?.email ?? '—'}</p>
          </div>
          <Badge variant={kyc.variant} className="shrink-0 gap-1">
            <kyc.Icon className="size-3" />
            {kyc.label}
          </Badge>
        </div>
      </section>

      {/* Withdrawal account */}
      <section className="space-y-3 max-w-lg">
        <div>
          <h2 className="text-sm font-semibold">Withdrawal account</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The bank account your wallet withdrawals will be sent to. Must be in your name.
          </p>
        </div>
        <BankAccountSection />
      </section>

      {/* Sign out */}
      <section className="max-w-lg">
        <Button
          variant="outline"
          className="w-full border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </section>
    </div>
  );
}
