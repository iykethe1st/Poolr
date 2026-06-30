"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CreditCard, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelativeDate } from "@/lib/format";
import {
  useInitializeContribution,
  useWalletContribute,
  useCanPayFromWallet,
} from "@/hooks/use-payments";
import type { ContributionWithGroup } from "@/hooks/use-dashboard";

const DUE_DOT: Record<string, string> = {
  PENDING: "bg-amber-400",
  OVERDUE: "bg-destructive",
};

function paystackFeeEstimate(amountNgn: number): number {
  const FLAT = amountNgn < 2_500 ? 0 : 100;
  const CAP = 2_000;
  const grossed = (amountNgn + FLAT) / (1 - 0.015) + 0.01;
  return Math.ceil(Math.min(grossed - amountNgn, CAP));
}

interface UpcomingContributionsProps {
  contributions: ContributionWithGroup[] | undefined;
  loading: boolean;
}

export function UpcomingContributions({
  contributions,
  loading,
}: UpcomingContributionsProps) {
  const upcoming = contributions
    ?.filter((c) => c.status === "PENDING" || c.status === "OVERDUE")
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 6);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Upcoming payments</h3>
        {!loading && upcoming && upcoming.length > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
            {upcoming.length}
          </span>
        )}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        {loading ? (
          <div className="divide-y">
            {[1, 2, 3].map((i) => (
              <ContribSkeleton key={i} />
            ))}
          </div>
        ) : !upcoming?.length ? (
          <EmptyContributions />
        ) : (
          <ul className="divide-y">
            {upcoming.map((c) => (
              <ContribRow key={c.id} contribution={c} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ContribRow({
  contribution: c,
}: {
  contribution: ContributionWithGroup;
}) {
  const router = useRouter();
  const init = useInitializeContribution();
  const walletPay = useWalletContribute();
  const { data: canPayData } = useCanPayFromWallet(c.cycleId);

  const [modalOpen, setModalOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"card" | "wallet">("card");

  const feeAmountNgn = canPayData?.fee_amount ?? 0;
  const penaltyAmountNgn = canPayData?.penalty_amount ?? 0;
  const totalAmountNgn = canPayData?.total_amount ?? Number(c.amount);
  const walletBalance = canPayData?.wallet_balance ?? 0;
  const canPayFromWallet = canPayData?.can_pay ?? false;
  const processingFee = paystackFeeEstimate(totalAmountNgn);
  const cardTotal = totalAmountNgn + processingFee;
  const shortfallNgn = totalAmountNgn - walletBalance;
  const isBusy = init.isPending || walletPay.isPending;
  const isOverdue = c.status === "OVERDUE";

  function handleContinue() {
    if (payMethod === "wallet") {
      walletPay.mutate(c.cycleId, {
        onSuccess: () => setModalOpen(false),
      });
    } else {
      init.mutate(c.cycleId, {
        onSuccess: ({ authorizationUrl, reference }) => {
          setModalOpen(false);
          if (authorizationUrl.includes("dev_mock")) {
            router.push(`/payments/callback?reference=${reference}`);
          } else {
            window.location.href = authorizationUrl;
          }
        },
      });
    }
  }

  return (
    <>
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) setModalOpen(false);
          if (open) setPayMethod("card");
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Payment summary</DialogTitle>
            <DialogDescription>
              {c.cycle.group.name} · Choose how you want to pay.
            </DialogDescription>
          </DialogHeader>

          {/* Fee breakdown */}
          <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contribution</span>
              <span className="font-medium">
                {formatCurrency(Number(c.amount))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform fee</span>
              <span className="font-medium">
                {formatCurrency(feeAmountNgn)}
              </span>
            </div>
            {penaltyAmountNgn > 0 && (
              <div className="flex justify-between">
                <span className="text-destructive">Late penalty</span>
                <span className="font-medium text-destructive">
                  {formatCurrency(penaltyAmountNgn)}
                </span>
              </div>
            )}
          </div>

          {/* Payment method selector */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pay with
            </p>

            <button
              type="button"
              onClick={() => setPayMethod("card")}
              className={cn(
                "w-full rounded-xl border-2 p-3 text-left transition-all",
                payMethod === "card"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Card / Bank transfer
                  </span>
                </div>
                <span className="text-sm font-semibold">
                  {formatCurrency(cardTotal)}
                </span>
              </div>
              <p className="mt-0.5 ml-6 text-xs text-muted-foreground">
                Includes ~{formatCurrency(processingFee)} Paystack processing
                fee
              </p>
            </button>

            <button
              type="button"
              onClick={() => canPayFromWallet && setPayMethod("wallet")}
              className={cn(
                "w-full rounded-xl border-2 p-3 text-left transition-all",
                !canPayFromWallet
                  ? "cursor-not-allowed opacity-50 border-border"
                  : payMethod === "wallet"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Poolr Wallet</span>
                </div>
                <span className="text-sm font-semibold">
                  {formatCurrency(totalAmountNgn)}
                </span>
              </div>
              <p className="mt-0.5 ml-6 text-xs text-muted-foreground">
                {canPayFromWallet
                  ? "No processing fee"
                  : shortfallNgn > 0
                    ? `Top up ${formatCurrency(shortfallNgn)} to use wallet`
                    : "Insufficient balance"}
              </p>
            </button>
          </div>

          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={handleContinue}
              disabled={isBusy}
            >
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              Continue to payment
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setModalOpen(false)}
              disabled={isBusy}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <li className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "mt-0.5 size-2 shrink-0 rounded-full",
              DUE_DOT[c.status] ?? "bg-muted",
            )}
          />
          <div className="min-w-0 flex-1">
            <Link
              href={`/groups/${c.cycle.group.id}`}
              className="truncate text-sm font-medium hover:underline"
            >
              {c.cycle.group.name}
            </Link>
            <p
              className={cn(
                "text-xs",
                isOverdue
                  ? "font-semibold text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {formatRelativeDate(c.dueAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <p className="text-sm font-semibold">
              {formatCurrency(Number(c.amount))}
            </p>
            <Button
              size="sm"
              variant={isOverdue ? "destructive" : "default"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setModalOpen(true)}
              disabled={isBusy}
            >
              Pay now
            </Button>
          </div>
        </div>
      </li>
    </>
  );
}

function EmptyContributions() {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <CalendarClock className="size-8 text-muted-foreground/50" />
      <p className="text-sm font-medium">All caught up!</p>
      <p className="text-xs text-muted-foreground">No upcoming payments.</p>
    </div>
  );
}

function ContribSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="size-2 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-7 w-20" />
    </div>
  );
}
