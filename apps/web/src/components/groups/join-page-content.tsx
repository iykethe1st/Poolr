"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { HTTPError } from "ky";
import { AlertTriangle, Loader2, ShieldCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { GroupTermsDialog } from "./group-terms-dialog";
import { isAuthenticated } from "@/lib/auth";
import { useGroup, useJoinGroup, useDeclineInvite } from "@/hooks/use-group";
import { useCurrentUser } from "@/hooks/use-dashboard";
import { formatCurrency, formatFrequency } from "@/lib/format";

interface Props {
  groupId: string;
}

export function JoinPageContent({ groupId }: Props) {
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  useEffect(() => {
    setAuthed(isAuthenticated());
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authed) {
    return <GuestView groupId={groupId} token={token} />;
  }

  return <AuthedView groupId={groupId} token={token} />;
}

function GuestView({ groupId, token }: { groupId: string; token: string }) {
  const returnUrl = `/groups/${groupId}/join${token ? `?token=${token}` : ""}`;
  const encoded = encodeURIComponent(returnUrl);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <Image src="/favicon.png" alt="Poolr" width={36} height={36} />
            <span className="text-2xl font-bold tracking-tight">Poolr</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Rotating savings circles, reimagined.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="mb-6 space-y-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Users className="size-7 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">You&apos;ve been invited!</h1>
            <p className="text-sm text-muted-foreground">
              Someone invited you to join a savings circle on Poolr. Create an
              account or sign in to accept your invitation.
            </p>
          </div>

          <div className="space-y-3">
            <Button className="w-full" asChild>
              <Link href={`/register?redirect=${encoded}`}>Create account</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/login?redirect=${encoded}`}>Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthedView({ groupId, token }: { groupId: string; token: string }) {
  const router = useRouter();
  const {
    data: group,
    isLoading: groupLoading,
    isError: groupError,
  } = useGroup(groupId);
  const { data: me } = useCurrentUser();
  const joinGroup = useJoinGroup(groupId);
  const declineInvite = useDeclineInvite(groupId);
  const [error, setError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [kycDialogOpen, setKycDialogOpen] = useState(false);
  const [slotCount, setSlotCount] = useState(1);

  const myMember = group?.members.find((m) => m.userId === me?.id);
  const isInvited = myMember?.memberStatus === "INVITED";
  const isActive = myMember?.memberStatus === "ACTIVE";

  const kycRedirect = encodeURIComponent(
    `/groups/${groupId}/join${token ? `?token=${token}` : ""}`,
  );

  useEffect(() => {
    if (isActive) router.replace(`/groups/${groupId}`);
  }, [isActive, groupId, router]);

  function handleAccept() {
    setError("");
    joinGroup.mutate(
      { token, slotCount },
      {
        onSuccess: () => {
          router.push(`/groups/${groupId}`);
          router.refresh();
        },
        onError: async (err) => {
          if (err instanceof HTTPError) {
            const body: { message?: string } = await err.response
              .json()
              .catch(() => ({}));
            if (
              err.response.status === 403 &&
              body.message?.toLowerCase().includes("kyc")
            ) {
              setKycDialogOpen(true);
              return;
            }
            setError(
              body.message ??
                "Failed to accept. The invite link may have expired.",
            );
          } else {
            setError("Something went wrong. Please try again.");
          }
        },
      },
    );
  }

  function handleDecline() {
    setError("");
    declineInvite.mutate(undefined, {
      onSuccess: () => router.push("/groups"),
      onError: async (err) => {
        if (err instanceof HTTPError) {
          const body: { message?: string } = await err.response
            .json()
            .catch(() => ({}));
          setError(body.message ?? "Failed to decline invitation.");
        } else {
          setError("Something went wrong. Please try again.");
        }
      },
    });
  }

  if (groupLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (groupError || !group) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm text-center space-y-4">
          <h1 className="text-xl font-semibold">Invite not found</h1>
          <p className="text-sm text-muted-foreground">
            This invite link is invalid, has expired, or isn&apos;t associated
            with your account.
          </p>
          <Button variant="outline" asChild>
            <Link href="/groups">View my groups</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!isInvited && !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm text-center space-y-4">
          <h1 className="text-xl font-semibold">No pending invite</h1>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have a pending invitation for this group.
          </p>
          <Button variant="outline" asChild>
            <Link href={`/groups/${groupId}`}>View group</Link>
          </Button>
        </div>
      </div>
    );
  }

  const busy = joinGroup.isPending || declineInvite.isPending;
  const memberCount = group.members.length;
  const penaltyEnabled = !!group.penaltyConfig;
  const maxSlotsByTier = me?.contributionStats?.maxSlotsEligible ?? 1;
  const trustScore = me?.contributionStats?.trustScore ?? 0;
  const availableSlots = group.maxMembers - memberCount + slotCount; // +slotCount because current user takes those spots
  const maxSelectable = Math.min(maxSlotsByTier, availableSlots);

  function slotNote(n: number): string {
    if (n === 1) return "All tiers";
    if (n > availableSlots) return "Group is full";
    if (n === 2 && trustScore < 60) return `Need 60+ Trust score`;
    if (n === 3 && trustScore < 80) return `Need 80+ Trust score`;
    return n === 2 ? "Reliable tier" : "Elite tier";
  }

  const SLOT_OPTIONS = [
    { value: 1, label: "1 slot" },
    { value: 2, label: "2 slots" },
    { value: 3, label: "3 slots" },
  ];

  return (
    <>
      {/* KYC required dialog */}
      <Dialog open={kycDialogOpen} onOpenChange={setKycDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-amber-100">
              <ShieldCheck className="size-6 text-amber-600" />
            </div>
            <DialogTitle>Identity verification required</DialogTitle>
            <DialogDescription>
              You need to verify your identity before joining a savings group.
              This protects everyone in the circle and is required for all
              members.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKycDialogOpen(false)}>
              Not now
            </Button>
            <Button asChild>
              <Link href={`/kyc?redirect=${kycRedirect}`}>Verify identity</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terms dialog */}
      <GroupTermsDialog open={termsOpen} onClose={() => setTermsOpen(false)} />

      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-sm space-y-4">
          {/* Branding */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <Image src="/favicon.png" alt="Poolr" width={32} height={32} />
              <span className="text-xl font-bold tracking-tight">Poolr</span>
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-0.5">
            <h1 className="text-2xl font-bold">You&apos;ve been invited</h1>
            <p className="text-sm text-muted-foreground">
              Review the group details before you accept.
            </p>
          </div>

          {/* Group card */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
            {/* Avatar + name */}
            <div className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <span className="text-xl font-bold text-primary">
                  {group.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold leading-tight">{group.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {group.status.toLowerCase()}
                </p>
              </div>
            </div>

            <div className="border-t" />

            {/* Detail rows */}
            <div className="space-y-2.5">
              <DetailRow
                label="Contribution"
                value={formatCurrency(group.contributionAmount, group.currency)}
              />
              <DetailRow
                label="Frequency"
                value={formatFrequency(group.frequency)}
              />
              <DetailRow
                label="Members"
                value={`${memberCount} / ${group.maxMembers}`}
              />
              {group.startDate && (
                <DetailRow
                  label="Start date"
                  value={new Date(group.startDate).toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                />
              )}
              <DetailRow
                label="Late penalties"
                value={penaltyEnabled ? "Yes — 5%" : "No"}
              />
            </div>
          </div>

          {/* Risk warning */}
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              By joining, you commit to contributing every cycle for the full
              duration.{" "}
              <strong>
                Any losses from members who default are shared by the entire
                group, including you.
              </strong>
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Slot selector */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold">Rotation slots span</p>
              <p className="text-xs text-muted-foreground">
                How many spots do you want in this group?
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SLOT_OPTIONS.map((opt) => {
                const disabled = opt.value > maxSelectable;
                const selected = slotCount === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSlotCount(opt.value)}
                    className={`flex flex-col items-center rounded-xl border px-2 py-2.5 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground leading-tight">
                      {slotNote(opt.value)}
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-muted-foreground">
              Your Trust score: {trustScore}
            </span>
          </div>

          {/* Terms checkbox */}
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 size-4 cursor-pointer accent-primary"
            />
            <span className="text-xs text-muted-foreground leading-snug">
              I agree to the{" "}
              <button
                type="button"
                className="font-medium text-primary underline underline-offset-2"
                onClick={() => setTermsOpen(true)}
              >
                Group Savings Circle Terms
              </button>
              , including the default risk and payout schedule.
            </span>
          </label>

          {/* Actions */}
          <div className="space-y-2.5">
            <Button
              className="w-full"
              onClick={handleAccept}
              disabled={busy || !termsAccepted}
            >
              {joinGroup.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Accept invitation
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleDecline}
              disabled={busy}
            >
              {declineInvite.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Decline
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
