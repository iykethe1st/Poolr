"use client";

import { useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { Cycle, GroupMember } from "@/hooks/use-group";

interface CycleTimelineProps {
  cycles: Cycle[];
  members: GroupMember[];
  contributionAmount: number;
  currency: string;
  currentUserId?: string;
}

const STATUS_CONFIG: Record<
  string,
  {
    icon: typeof CheckCircle2;
    color: string;
    badge: "success" | "warning" | "outline" | "destructive";
    label: string;
  }
> = {
  COMPLETED: {
    icon: CheckCircle2,
    color: "text-primary",
    badge: "success",
    label: "Completed",
  },
  ACTIVE: {
    icon: Clock,
    color: "text-amber-700 dark:text-amber-300",
    badge: "warning",
    label: "In progress",
  },
  OVERDUE: {
    icon: AlertCircle,
    color: "text-destructive",
    badge: "destructive",
    label: "Overdue",
  },
  PENDING: {
    icon: Circle,
    color: "text-muted-foreground",
    badge: "outline",
    label: "Upcoming",
  },
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

export function CycleTimeline({
  cycles,
  members,
  contributionAmount,
  currency,
  currentUserId,
}: CycleTimelineProps) {
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const sortedCycles = [...cycles].sort(
    (a, b) => a.cycleNumber - b.cycleNumber,
  );
  const membersById = new Map(members.map((member) => [member.id, member]));
  const membersByUserId = new Map(
    members.map((member) => [member.userId, member]),
  );
  const activeMemberCount = members.filter(
    (member) => member.memberStatus === "ACTIVE",
  ).length;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sortedCycles.map((cycle) => {
          const {
            icon: Icon,
            color,
            badge,
            label,
          } = STATUS_CONFIG[cycle.status] ?? STATUS_CONFIG.PENDING;
          const recipient = membersByUserId.get(cycle.recipientId);
          const isMyReceivingCycle = cycle.recipientId === currentUserId;
          const paidCount = cycle.contributions.filter(
            (contribution) => contribution.status === "PAID",
          ).length;
          const totalCount = cycle.contributions.length;
          const paidAmount = cycle.contributions
            .filter((contribution) => contribution.status === "PAID")
            .reduce(
              (sum, contribution) => sum + Number(contribution.amount),
              0,
            );
          const potAmount =
            cycle.contributions.length > 0
              ? cycle.contributions.reduce(
                  (sum, contribution) => sum + Number(contribution.amount),
                  0,
                )
              : contributionAmount * activeMemberCount;

          return (
            <button
              key={cycle.id}
              type="button"
              onClick={() => setSelectedCycle(cycle)}
              aria-label={`View activity for cycle ${cycle.cycleNumber}`}
              className="group flex min-h-48 w-full flex-col rounded-2xl border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div className="flex w-full items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Icon className={cn("size-5", color)} aria-hidden="true" />
                  </span>
                  <div>
                    <span className="block text-base font-semibold leading-6">
                      Cycle {cycle.cycleNumber}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {recipient?.user.fullName ?? "Recipient not assigned"}
                    </span>
                  </div>
                </div>
                <Badge variant={badge}>{label}</Badge>
              </div>

              <div className="mt-5 flex items-end justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {paidCount} of {totalCount || activeMemberCount}{" "}
                    contributions paid
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Due {formatDate(cycle.dueDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-muted-foreground">
                    {paidCount > 0 ? "Collected" : "Expected pot"}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-base font-semibold tabular-nums">
                    {formatCurrency(
                      paidCount > 0 ? paidAmount : potAmount,
                      currency,
                    )}
                  </p>
                </div>
              </div>

              {isMyReceivingCycle &&
                (cycle.status === "ACTIVE" || cycle.status === "PENDING") && (
                  <div className="mt-4 border-t pt-3">
                    <span className="text-sm font-medium text-primary">
                      You receive this cycle
                    </span>
                  </div>
                )}

              <span className="mt-auto flex items-center justify-end gap-1 pt-4 text-sm font-medium text-primary">
                View cycle activity
                <ChevronRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </button>
          );
        })}
      </div>

      <Dialog
        open={selectedCycle !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCycle(null);
        }}
      >
        {selectedCycle && (
          <CycleActivityDialog
            cycle={selectedCycle}
            membersById={membersById}
            currency={currency}
            activeMemberCount={activeMemberCount}
          />
        )}
      </Dialog>
    </>
  );
}

function CycleActivityDialog({
  cycle,
  membersById,
  currency,
  activeMemberCount,
}: {
  cycle: Cycle;
  membersById: Map<string, GroupMember>;
  currency: string;
  activeMemberCount: number;
}) {
  const { badge, label } = STATUS_CONFIG[cycle.status] ?? STATUS_CONFIG.PENDING;
  const sortedContributions = [...cycle.contributions].sort((a, b) => {
    if (a.status === "PAID" && b.status !== "PAID") return -1;
    if (a.status !== "PAID" && b.status === "PAID") return 1;
    if (a.paidAt && b.paidAt) {
      return new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime();
    }
    return 0;
  });
  const paidCount = cycle.contributions.filter(
    (contribution) => contribution.status === "PAID",
  ).length;
  const paidAmount = cycle.contributions
    .filter((contribution) => contribution.status === "PAID")
    .reduce((sum, contribution) => sum + Number(contribution.amount), 0);

  return (
    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
      <DialogHeader className="border-b px-6 py-6 pr-14 sm:px-7">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-xl font-semibold leading-7">
              Cycle {cycle.cycleNumber} activity
            </DialogTitle>
            <Badge variant={badge}>{label}</Badge>
          </div>
        </div>
        <DialogDescription className="text-sm leading-6">
          Contribution status and payment time for each group member.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4 border-b bg-muted/30 px-6 py-4 sm:px-7">
        <div>
          <p className="text-sm text-muted-foreground">Collected</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatCurrency(paidAmount, currency)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Contributions</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {paidCount} / {cycle.contributions.length || activeMemberCount} paid
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 sm:px-7">
        {sortedContributions.length === 0 ? (
          <div className="py-10 text-center">
            <Users
              className="mx-auto mb-3 size-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-base font-medium">No contributions recorded</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Member payments for this cycle will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {sortedContributions.map((contribution) => {
              const member = membersById.get(contribution.memberId);
              const isPaid = contribution.status === "PAID";
              const isFailed = ["FAILED", "OVERDUE"].includes(
                contribution.status,
              );
              const memberName = member?.user.fullName ?? "Group member";

              return (
                <li
                  key={contribution.id}
                  className="flex items-center gap-3 py-4 first:pt-1 last:pb-1"
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      isPaid
                        ? "bg-primary/10 text-primary"
                        : isFailed
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isPaid ? (
                      <CheckCircle2 className="size-5" aria-hidden="true" />
                    ) : isFailed ? (
                      <AlertCircle className="size-5" aria-hidden="true" />
                    ) : (
                      <Clock className="size-5" aria-hidden="true" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium">
                      {memberName}
                    </p>
                    {isPaid && contribution.paidAt ? (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CalendarDays
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        Paid {formatDateTime(contribution.paidAt)}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isPaid ? "Payment time unavailable" : "Not paid yet"}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-base font-semibold tabular-nums">
                      {formatCurrency(Number(contribution.amount), currency)}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm font-medium",
                        isPaid
                          ? "text-primary"
                          : isFailed
                            ? "text-destructive"
                            : "text-muted-foreground",
                      )}
                    >
                      {isPaid
                        ? "Paid"
                        : contribution.status === "OVERDUE"
                          ? "Overdue"
                          : contribution.status === "FAILED"
                            ? "Failed"
                            : "Pending"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5 flex items-center justify-between gap-4 border-t pt-4 text-sm">
          <span className="text-muted-foreground">Cycle due date</span>
          <span className="font-medium">{formatDate(cycle.dueDate)}</span>
        </div>
      </div>
    </DialogContent>
  );
}
