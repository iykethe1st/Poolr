'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HTTPError } from 'ky';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-shell';
import { formatCurrency } from '@/lib/format';
import {
  useWallet,
  useWalletTransactions,
  useTopUpWallet,
  useWithdrawFromWallet,
  type WalletTransaction,
} from '@/hooks/use-wallet';
import { useMyBankAccount } from '@/hooks/use-bank-account';

const TX_LABEL: Record<WalletTransaction['type'], string> = {
  CONTRIBUTION: 'Contribution',
  PAYOUT: 'Payout received',
  PENALTY: 'Penalty',
  TOPUP: 'Top-up',
  WITHDRAWAL: 'Withdrawal',
  REVERSAL: 'Reversal',
};

export function WalletContent() {
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: txPage, isLoading: txLoading } = useWalletTransactions(1, 20);
  const { data: bankAccount } = useMyBankAccount();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const balance = Number(wallet?.balance ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Wallet" description="Your Poolr wallet balance and transaction history." />

      {/* Balance card */}
      <div className="rounded-2xl border bg-card px-6 py-6 space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="size-4" />
          Available balance
        </div>
        {walletLoading ? (
          <Skeleton className="h-10 w-48" />
        ) : (
          <p className="text-4xl font-bold tracking-tight text-primary">
            {formatCurrency(balance, 'NGN')}
          </p>
        )}
        <div className="flex gap-3">
          <Button onClick={() => setTopUpOpen(true)} disabled={walletLoading}>
            <ArrowDownLeft className="size-4" />
            Top up
          </Button>
          <Button variant="outline" onClick={() => setWithdrawOpen(true)} disabled={walletLoading || balance < 100}>
            <ArrowUpRight className="size-4" />
            Withdraw
          </Button>
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Transaction history
        </h2>

        {txLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : !txPage?.items.length ? (
          <div className="rounded-xl border bg-card px-4 py-10 text-center">
            <Wallet className="mx-auto mb-2 size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No transactions yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Top up your wallet to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {txPage.items.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>

      {/* Bank account card */}
      {bankAccount ? (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <ArrowUpRight className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{bankAccount.accountName}</p>
            <p className="text-xs text-muted-foreground">{bankAccount.bankName} · {bankAccount.accountNumber}</p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">Withdrawal account</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-dashed bg-card px-4 py-3">
          <AlertCircle className="size-4 text-muted-foreground/60 shrink-0" />
          <p className="text-sm text-muted-foreground">
            No bank account linked —{' '}
            <a href="/settings" className="text-primary underline underline-offset-2">add one in Settings</a>
            {' '}to withdraw.
          </p>
        </div>
      )}

      <TopUpDialog open={topUpOpen} onClose={() => setTopUpOpen(false)} />
      <WithdrawDialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} balance={balance} />
    </div>
  );
}

function TxRow({ tx }: { tx: WalletTransaction }) {
  const isCredit = tx.direction === 'CREDIT';

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <div
        className={[
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          isCredit ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' : 'bg-red-50 text-red-600 dark:bg-red-950/40',
        ].join(' ')}
      >
        {isCredit ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{TX_LABEL[tx.type]}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(tx.createdAt).toLocaleDateString('en-NG', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      </div>
      <p className={['text-sm font-semibold tabular-nums', isCredit ? 'text-emerald-600' : 'text-red-600'].join(' ')}>
        {isCredit ? '+' : '-'}{formatCurrency(Number(tx.amount), 'NGN')}
      </p>
    </div>
  );
}

function TopUpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const topUp = useTopUpWallet();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed < 100) {
      setError('Minimum top-up is ₦100');
      return;
    }
    setError('');
    topUp.mutate(parsed);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Top up wallet</DialogTitle>
          <DialogDescription>Add funds via Paystack. Minimum ₦100.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="topup-amount">Amount (₦)</Label>
            <Input
              id="topup-amount"
              type="number"
              min={100}
              step={100}
              placeholder="5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex gap-2">
              {[1000, 5000, 10000, 20000].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAmount(String(n))}
                  className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  ₦{(n / 1000).toFixed(0)}k
                </button>
              ))}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={topUp.isPending}>
              {topUp.isPending && <Loader2 className="size-4 animate-spin" />}
              Continue to Paystack
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({
  open,
  onClose,
  balance,
}: {
  open: boolean;
  onClose: () => void;
  balance: number;
}) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [noBankAccount, setNoBankAccount] = useState(false);
  const [success, setSuccess] = useState(false);
  const withdraw = useWithdrawFromWallet();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed < 100) {
      setError('Minimum withdrawal is ₦100');
      return;
    }
    if (parsed > balance) {
      setError(`You only have ${formatCurrency(balance, 'NGN')} available`);
      return;
    }
    setError('');
    setNoBankAccount(false);
    withdraw.mutate(parsed, {
      onSuccess: () => setSuccess(true),
      onError: async (err) => {
        if (err instanceof HTTPError) {
          const body: { message?: string } = await err.response.json().catch(() => ({}));
          if (err.response.status === 400 && body.message?.toLowerCase().includes('bank account')) {
            setNoBankAccount(true);
          } else {
            setError(body.message ?? 'Withdrawal failed. Please try again.');
          }
        } else {
          setError('Withdrawal failed. Please try again.');
        }
      },
    });
  }

  function handleClose() {
    setAmount('');
    setError('');
    setNoBankAccount(false);
    setSuccess(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Withdraw to bank</DialogTitle>
          <DialogDescription>
            Funds will be sent to your registered bank account.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 text-center py-2">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
              <ArrowUpRight className="size-6" />
            </div>
            <p className="font-medium">Withdrawal initiated</p>
            <p className="text-sm text-muted-foreground">
              Your transfer is being processed and should arrive shortly.
            </p>
            <Button onClick={handleClose} className="w-full">Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="withdraw-amount">Amount (₦)</Label>
              <Input
                id="withdraw-amount"
                type="number"
                min={100}
                max={balance}
                step={100}
                placeholder="5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Available: {formatCurrency(balance, 'NGN')}
              </p>
              {noBankAccount && (
                <p className="flex items-start gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3 mt-0.5 shrink-0" />
                  <span>
                    No bank account registered.{' '}
                    <Link href="/settings" className="underline underline-offset-2" onClick={handleClose}>
                      Add one in Settings
                    </Link>
                    {' '}to withdraw.
                  </span>
                </p>
              )}
              {error && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" />
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={withdraw.isPending}>
                {withdraw.isPending && <Loader2 className="size-4 animate-spin" />}
                Withdraw
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
