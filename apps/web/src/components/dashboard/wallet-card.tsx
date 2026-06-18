'use client';

import Link from 'next/link';
import { ArrowUpRight, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { useWallet } from '@/hooks/use-wallet';

export function WalletBalanceCard() {
  const { data: wallet, isLoading } = useWallet();

  if (isLoading) return <WalletCardSkeleton />;

  const balance = Number(wallet?.balance ?? 0);

  return (
    <div className="rounded-xl border bg-card px-4 py-4 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Wallet className="size-3.5" />
          Poolr wallet
        </div>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" asChild>
          <Link href="/wallet">
            <ArrowUpRight className="size-3" />
            Manage
          </Link>
        </Button>
      </div>
      <p className="text-2xl font-bold tracking-tight">
        {formatCurrency(balance, 'NGN')}
      </p>
      <p className="text-xs text-muted-foreground">
        {balance > 0 ? 'Available to withdraw or pay contributions' : 'Top up to pay contributions from wallet'}
      </p>
    </div>
  );
}

function WalletCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card px-4 py-4 space-y-2 animate-pulse">
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="h-7 w-36 rounded bg-muted" />
      <div className="h-3 w-32 rounded bg-muted" />
    </div>
  );
}
