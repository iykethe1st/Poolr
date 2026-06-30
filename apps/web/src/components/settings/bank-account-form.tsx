"use client";

import { useState } from "react";
import { HTTPError } from "ky";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useBanks,
  useMyBankAccount,
  useResolveAccount,
  useRemoveBankAccount,
  useSaveBankAccount,
} from "@/hooks/use-bank-account";

type Step = "idle" | "form" | "confirm" | "saved";

export function BankAccountSection() {
  const { data: account, isLoading } = useMyBankAccount();
  const [step, setStep] = useState<Step>("idle");

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-32 rounded bg-muted animate-pulse" />
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (account && step !== "form") {
    return (
      <ExistingAccount account={account} onRemove={() => setStep("idle")} />
    );
  }

  if (step === "idle") {
    return (
      <div className="rounded-xl border border-dashed bg-card px-4 py-6 text-center">
        <CreditCard className="mx-auto mb-2 size-8 text-muted-foreground/40" />
        <p className="text-sm font-medium">No bank account saved</p>
        <p className="mt-0.5 text-xs text-muted-foreground mb-4">
          Required to withdraw funds from your Poolr wallet
        </p>
        <Button size="sm" onClick={() => setStep("form")}>
          Add bank account
        </Button>
      </div>
    );
  }

  return (
    <AddBankAccountFlow
      onSuccess={() => setStep("saved")}
      onCancel={() => setStep("idle")}
    />
  );
}

function ExistingAccount({
  account,
  onRemove,
}: {
  account: { bankName: string; accountNumber: string; accountName: string };
  onRemove: () => void;
}) {
  const remove = useRemoveBankAccount();
  const [confirming, setConfirming] = useState(false);

  function handleRemove() {
    remove.mutate(undefined, { onSuccess: onRemove });
  }

  return (
    <div className="rounded-xl border bg-card px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
          <BadgeCheck className="size-5 text-green-600 dark:text-green-400" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{account.accountName}</p>
          <p className="text-xs text-muted-foreground">
            {account.bankName} · {account.accountNumber}
          </p>
        </div>
        {confirming ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-destructive">Remove?</span>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-2 text-xs"
              onClick={handleRemove}
              disabled={remove.isPending}
            >
              {remove.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                "Yes"
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setConfirming(false)}
            >
              No
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function AddBankAccountFlow({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { data: banks = [], isLoading: banksLoading } = useBanks();
  const resolve = useResolveAccount();
  const save = useSaveBankAccount();

  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [error, setError] = useState("");

  const selectedBank = banks.find((b) => b.code === bankCode);
  const canResolve = bankCode && accountNumber.length === 10;
  const isStep2 = !!resolvedName;

  function handleBankChange(code: string) {
    setBankCode(code);
    const b = banks.find((b) => b.code === code);
    setBankName(b?.name ?? "");
    setResolvedName("");
    setError("");
  }

  function handleAccountNumberChange(val: string) {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    setAccountNumber(digits);
    setResolvedName("");
    setError("");
  }

  function handleVerify() {
    setError("");
    resolve.mutate(
      { bankCode, accountNumber },
      {
        onSuccess: (result) => setResolvedName(result.accountName),
        onError: async (err) => {
          if (err instanceof HTTPError) {
            const body: { message?: string } = await err.response
              .json()
              .catch(() => ({}));
            setError(
              body.message ??
                "Could not verify account. Check details and try again.",
            );
          } else {
            setError("Could not verify account. Check details and try again.");
          }
        },
      },
    );
  }

  function handleSave() {
    setError("");
    save.mutate(
      { bankCode, bankName, accountNumber, accountName: resolvedName },
      {
        onSuccess: onSuccess,
        onError: async (err) => {
          if (err instanceof HTTPError) {
            const body: { message?: string } = await err.response
              .json()
              .catch(() => ({}));
            setError(body.message ?? "Failed to save account.");
          } else {
            setError("Failed to save account.");
          }
        },
      },
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Add bank account</h3>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2.5 flex gap-2">
        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-300">
          Withdrawals can only be sent to <strong>your own bank account</strong>
          . Make sure the account name matches your verified identity.
        </p>
      </div>

      <div className="space-y-3">
        {/* Bank selector */}
        <div className="space-y-1.5">
          <Label className="text-xs">Bank</Label>
          <select
            value={bankCode}
            onChange={(e) => handleBankChange(e.target.value)}
            disabled={banksLoading || isStep2}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          >
            <option value="">
              {banksLoading ? "Loading banks…" : "Select your bank"}
            </option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Account number */}
        <div className="space-y-1.5">
          <Label className="text-xs">Account number</Label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="10-digit account number"
            value={accountNumber}
            onChange={(e) => handleAccountNumberChange(e.target.value)}
            disabled={isStep2}
            maxLength={10}
          />
        </div>

        {/* Step 1 verify button */}
        {!isStep2 && (
          <Button
            className="w-full"
            onClick={handleVerify}
            disabled={!canResolve || resolve.isPending}
          >
            {resolve.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Verify account
          </Button>
        )}

        {/* Step 2 — confirm account name */}
        {isStep2 && (
          <div className="rounded-xl border bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800 px-4 py-3 space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Account name</p>
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                  {resolvedName}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedBank?.name} · {accountNumber}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={save.isPending}
              >
                {save.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                Yes, save this account
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setResolvedName("");
                }}
                disabled={save.isPending}
              >
                Change
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="size-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground"
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  );
}
