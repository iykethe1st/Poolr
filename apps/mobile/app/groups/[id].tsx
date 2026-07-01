import { useState, useMemo } from "react";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  useGroupDetail,
  useGroupHistory,
  useInviteMember,
  useUpdateGroup,
  useStartGroup,
  useDeleteGroup,
  useRemoveMember,
  useUpdateMySlots,
  useOfferSlot,
  useAcceptInvite,
  useDeclineInvite,
} from "@/hooks/use-group";
import {
  useInitializeContribution,
  useVerifyPayment,
  useCanPayFromWallet,
} from "@/hooks/use-payments";
import { useCurrentUser } from "@/hooks/use-dashboard";
import { useColors } from "@/lib/colors";
import {
  formatCurrency,
  formatDate,
  formatRelativeDate,
  initials,
  timeAgo,
} from "@/lib/format";
import { tierConfig } from "@/lib/tier";
import { StatusBadge } from "@/components/status-badge";
import type { BadgeVariant } from "@/components/status-badge";
import type { Cycle, GroupMember, GroupHistory } from "@/hooks/use-group";

type Tab = "cycles" | "members" | "activity" | "payouts" | "penalties";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("cycles");

  const { data: group, isLoading, refetch } = useGroupDetail(id);
  const { data: history, refetch: refetchHistory } = useGroupHistory(id);
  const { data: me } = useCurrentUser();
  const initContrib = useInitializeContribution();
  const verifyPayment = useVerifyPayment();
  const inviteMember = useInviteMember(id);

  const updateGroup = useUpdateGroup(id);
  const startGroup = useStartGroup(id);
  const deleteGroup = useDeleteGroup(id);
  const updateMySlots = useUpdateMySlots(id);
  const offerSlot = useOfferSlot(id);
  const acceptOffer = useAcceptInvite(id);
  const declineOffer = useDeclineInvite(id);

  const activeCycleId = group?.cycles.find(
    (c) => c.status === "ACTIVE" || c.status === "IN_PROGRESS",
  )?.id;
  const { data: canPayData } = useCanPayFromWallet(activeCycleId);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<"phone" | "email">("phone");
  const [inviteValue, setInviteValue] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState<{
    message: string;
    token: string;
  } | null>(null);
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(
    null,
  );
  const [selectedMemberSlots, setSelectedMemberSlots] = useState(1);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"card" | "wallet">("card");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dateInput, setDateInput] = useState("");

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  function navigateToSuccess(
    amount: number | undefined,
    groupId: string | undefined,
    groupName: string | undefined,
  ) {
    void refetch();
    void refetchHistory();
    router.replace({
      pathname: "/payment-success",
      params: {
        type: "contribution",
        amount: amount !== undefined ? String(amount) : "",
        groupId: groupId ?? group?.id ?? "",
        groupName: groupName ?? group?.name ?? "",
      },
    } as never);
  }

  async function handlePay(cycleId: string, useWallet = false) {
    try {
      const result = await initContrib.mutateAsync({ cycleId, useWallet });

      if (useWallet || !result.authorizationUrl) {
        navigateToSuccess(result.totalChargedNgn, group?.id, group?.name);
        return;
      }

      // Open Paystack browser and poll for completion in parallel.
      // Once payment is verified as successful, dismiss the browser automatically.
      let pollTimer: ReturnType<typeof setTimeout>;
      let attempts = 0;
      const maxAttempts = 6; // poll up to ~30s (every 5s)

      function poll() {
        pollTimer = setTimeout(async () => {
          attempts++;
          try {
            const verified = await verifyPayment.mutateAsync(result.reference);
            if (verified.status === "success") {
              WebBrowser.dismissBrowser();
              navigateToSuccess(
                verified.amount ?? result.totalChargedNgn,
                verified.groupId,
                verified.groupName,
              );
              return;
            }
          } catch {
            // not yet verified — keep polling
          }
          if (attempts < maxAttempts) poll();
        }, 5000);
      }

      poll();

      const browserResult = await WebBrowser.openAuthSessionAsync(
        result.authorizationUrl,
        "poolr://payment-callback",
      );

      clearTimeout(pollTimer!);

      // Also handle the redirect-based close (deep link worked)
      if (browserResult.type === "success" && browserResult.url) {
        const url = new URL(browserResult.url);
        const ref = url.searchParams.get("reference") ?? result.reference;
        try {
          const verified = await verifyPayment.mutateAsync(ref);
          if (verified.status === "success") {
            navigateToSuccess(
              verified.amount ?? result.totalChargedNgn,
              verified.groupId,
              verified.groupName,
            );
          } else {
            Alert.alert(
              "Payment pending",
              "Payment is being processed. Check back shortly.",
            );
          }
        } catch {
          Alert.alert(
            "Payment pending",
            "Payment is being processed. Check back shortly.",
          );
        }
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Payment failed. Please try again.";
      Alert.alert("Error", msg);
    }
  }

  async function handleInvite() {
    if (!inviteValue.trim()) return;
    try {
      const result = await inviteMember.mutateAsync(
        inviteMode === "phone"
          ? { phone: inviteValue.trim() }
          : { email: inviteValue.trim() },
      );
      setInviteSuccess(result);
      setInviteValue("");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to send invite. Please try again.";
      Alert.alert("Error", msg);
    }
  }

  function openInvite() {
    setInviteValue("");
    setInviteSuccess(null);
    setInviteOpen(true);
  }

  if (isLoading || !group) {
    return (
      <View style={styles.loadingRoot}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  const myMember = group.members.find((m) => m.userId === me?.id);
  const isAdmin = me?.id === group.adminId;
  const isDraft = group.status === "DRAFT";
  const totalSlots = group.members.filter((m) =>
    ["ACTIVE", "INVITED"].includes(m.memberStatus),
  ).length;
  const canInvite = isAdmin && isDraft && totalSlots < group.maxMembers;
  const myActiveSlots = group.members.filter(
    (m) => m.userId === me?.id && m.memberStatus === "ACTIVE",
  );
  const mySlots = myActiveSlots.length;
  const myPendingOffer = group.members.find(
    (m) => m.userId === me?.id && m.memberStatus === "INVITED",
  );
  const hasSlotOffer = !isAdmin && mySlots > 0 && !!myPendingOffer;
  const activeMembers = group.members.filter(
    (m) => m.memberStatus === "ACTIVE",
  );
  const canStart =
    isAdmin && isDraft && activeMembers.length >= 2 && !!group.startDate;

  async function handleSaveDate() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      Alert.alert(
        "Invalid date",
        "Enter a date as YYYY-MM-DD, e.g. 2025-08-01",
      );
      return;
    }
    updateGroup.mutate(
      { startDate: dateInput },
      {
        onSuccess: () => setDatePickerOpen(false),
        onError: async (err: unknown) => {
          const body =
            err && typeof err === "object" && "response" in err
              ? ((await (err as { response: Response }).response
                  .json()
                  .catch(() => ({}))) as { message?: string })
              : {};
          Alert.alert("Error", body.message ?? "Failed to save date.");
        },
      },
    );
  }

  function handleStartGroup() {
    const name = group?.name ?? "";
    Alert.alert(
      `Start "${name}"?`,
      `This will lock the rotation and generate ${activeMembers.length} cycles. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start group",
          style: "destructive",
          onPress: () =>
            startGroup.mutate(undefined, {
              onError: async (err: unknown) => {
                const body =
                  err && typeof err === "object" && "response" in err
                    ? ((await (err as { response: Response }).response
                        .json()
                        .catch(() => ({}))) as { message?: string })
                    : {};
                Alert.alert("Error", body.message ?? "Failed to start group.");
              },
            }),
        },
      ],
    );
  }
  const canDelete = isAdmin && group.status !== "ACTIVE";

  function handleDeleteGroup() {
    const name = group?.name ?? "";
    Alert.alert(
      `Delete "${name}"?`,
      "The group will be removed from all members' views. All records are preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete group",
          style: "destructive",
          onPress: () =>
            deleteGroup.mutate(undefined, {
              onSuccess: () => router.replace("/(tabs)/groups" as never),
              onError: async (err: unknown) => {
                const body =
                  err && typeof err === "object" && "response" in err
                    ? ((await (err as { response: Response }).response
                        .json()
                        .catch(() => ({}))) as { message?: string })
                    : {};
                Alert.alert("Error", body.message ?? "Failed to delete group.");
              },
            }),
        },
      ],
    );
  }

  const activeCycle = group.cycles.find(
    (c) => c.status === "ACTIVE" || c.status === "IN_PROGRESS",
  );
  const myContrib = activeCycle?.contributions?.find(
    (c) => c.memberId === myMember?.id,
  );
  const canPay =
    myMember &&
    activeCycle &&
    (!myContrib ||
      myContrib.status === "PENDING" ||
      myContrib.status === "OVERDUE");

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.groupMeta}>
              {group.members.length}/{group.maxMembers} members ·{" "}
              {group.frequency.toLowerCase()} ·{" "}
              {formatCurrency(group.contributionAmount)}
            </Text>
          </View>
          {canInvite && (
            <TouchableOpacity style={styles.inviteBtn} onPress={openInvite}>
              <Text style={styles.inviteBtnText}>+ Invite</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Pay CTA */}
      {canPay &&
        (() => {
          const isBusy = initContrib.isPending || verifyPayment.isPending;
          return (
            <View style={styles.payCta}>
              <View>
                <Text style={styles.payCtaTitle}>
                  Cycle {activeCycle!.cycleNumber} contribution due
                </Text>
                <Text style={styles.payCtaDate}>
                  {formatRelativeDate(activeCycle!.dueDate)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <TouchableOpacity
                  style={[styles.payBtn, isBusy && styles.payBtnDisabled]}
                  onPress={() => {
                    setPayMethod("card");
                    setPayModalOpen(true);
                  }}
                  disabled={isBusy}
                >
                  <Text style={styles.payBtnText}>Pay Now</Text>
                </TouchableOpacity>
                <Text style={styles.paystackBadge}>🔒 Secured by Paystack</Text>
              </View>
            </View>
          );
        })()}

      {/* Payment summary modal */}
      {activeCycle &&
        (() => {
          const feeAmountNgn = canPayData?.fee_amount ?? 0;
          const penaltyAmountNgn = canPayData?.penalty_amount ?? 0;
          const totalAmountNgn =
            canPayData?.total_amount ?? Number(group.contributionAmount);
          const walletBalance = canPayData?.wallet_balance ?? 0;
          const canWallet = canPayData?.can_pay ?? false;
          const shortfallNgn = totalAmountNgn - walletBalance;
          const _flat = totalAmountNgn < 2_500 ? 0 : 100;
          const processingFee = Math.ceil(
            Math.min(
              (totalAmountNgn + _flat) / (1 - 0.015) + 0.01 - totalAmountNgn,
              2_000,
            ),
          );
          const cardTotal = totalAmountNgn + processingFee;
          const isBusy = initContrib.isPending || verifyPayment.isPending;

          return (
            <Modal
              visible={payModalOpen}
              animationType="slide"
              transparent
              onRequestClose={() => setPayModalOpen(false)}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1 }}
              >
                <Pressable
                  style={styles.feeModalBackdrop}
                  onPress={() => setPayModalOpen(false)}
                />
                <View style={styles.feeModalSheet}>
                  <View style={styles.feeModalHandle} />
                  <Text style={styles.feeModalTitle}>Payment summary</Text>

                  {/* Fee breakdown */}
                  <View style={styles.feeBreakdown}>
                    <View style={styles.feeRow}>
                      <Text style={styles.feeRowLabel}>Contribution</Text>
                      <Text style={styles.feeRowValue}>
                        {formatCurrency(group.contributionAmount)}
                      </Text>
                    </View>
                    <View style={styles.feeRow}>
                      <Text style={styles.feeRowLabel}>Platform fee</Text>
                      <Text style={styles.feeRowValue}>
                        {formatCurrency(feeAmountNgn)}
                      </Text>
                    </View>
                    {penaltyAmountNgn > 0 && (
                      <View style={styles.feeRow}>
                        <Text
                          style={[
                            styles.feeRowLabel,
                            { color: colors.destructive },
                          ]}
                        >
                          Late penalty
                        </Text>
                        <Text
                          style={[
                            styles.feeRowValue,
                            { color: colors.destructive },
                          ]}
                        >
                          {formatCurrency(penaltyAmountNgn)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Payment method selector */}
                  <Text style={styles.methodLabel}>Pay with</Text>

                  <TouchableOpacity
                    style={[
                      styles.methodOption,
                      payMethod === "card" && styles.methodOptionSelected,
                    ]}
                    onPress={() => setPayMethod("card")}
                  >
                    <View style={styles.methodRow}>
                      <Text style={styles.methodName}>
                        Card / Bank transfer
                      </Text>
                      <Text style={styles.methodAmount}>
                        {formatCurrency(cardTotal)}
                      </Text>
                    </View>
                    <Text style={styles.methodSub}>
                      Includes ~{formatCurrency(processingFee)} Paystack
                      processing fee
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.methodOption,
                      payMethod === "wallet" && styles.methodOptionSelected,
                      !canWallet && styles.methodOptionDisabled,
                    ]}
                    onPress={() => canWallet && setPayMethod("wallet")}
                    disabled={!canWallet}
                  >
                    <View style={styles.methodRow}>
                      <Text
                        style={[
                          styles.methodName,
                          !canWallet && { color: colors.textMuted },
                        ]}
                      >
                        Poolr Wallet
                      </Text>
                      <Text
                        style={[
                          styles.methodAmount,
                          !canWallet && { color: colors.textMuted },
                        ]}
                      >
                        {formatCurrency(totalAmountNgn)}
                      </Text>
                    </View>
                    <Text style={styles.methodSub}>
                      {canWallet
                        ? "No processing fee"
                        : shortfallNgn > 0
                          ? `Top up ${formatCurrency(shortfallNgn)} to use wallet`
                          : "Insufficient balance"}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.feeModalActions}>
                    <TouchableOpacity
                      style={[
                        styles.feeConfirmBtn,
                        isBusy && styles.payBtnDisabled,
                      ]}
                      onPress={() =>
                        handlePay(activeCycle.id, payMethod === "wallet")
                      }
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.feeConfirmBtnText}>
                          Continue to payment
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.feeCancelBtn}
                      onPress={() => setPayModalOpen(false)}
                      disabled={isBusy}
                    >
                      <Text style={styles.feeCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </Modal>
          );
        })()}

      {/* Virtual account card */}
      {group.groupAccount && (
        <View style={styles.vaCard}>
          <Text style={styles.vaLabel}>Group bank account</Text>
          <Text style={styles.vaAccount}>{group.groupAccount.accountName}</Text>
          <Text style={styles.vaSub}>
            {group.groupAccount.bankName} · {group.groupAccount.accountNumber}
          </Text>
        </View>
      )}

      {/* Admin self-slot control */}
      {isAdmin && isDraft && (
        <View style={styles.slotControlCard}>
          <Text style={styles.slotControlTitle}>Your slots</Text>
          <Text style={styles.slotControlSub}>
            Reserve multiple positions in the rotation for yourself.
          </Text>
          <View style={styles.slotControlRow}>
            {([1, 2, 3] as const).map((n) => {
              const wouldFit = totalSlots - mySlots + n <= group.maxMembers;
              const isSelected = n === mySlots;
              const disabled = !wouldFit || updateMySlots.isPending;
              return (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.slotOption,
                    isSelected && styles.slotOptionSelected,
                    disabled && !isSelected && styles.slotOptionDisabled,
                  ]}
                  onPress={() => {
                    if (isSelected || disabled) return;
                    updateMySlots.mutate(n, {
                      onError: async (err: unknown) => {
                        const body =
                          err && typeof err === "object" && "response" in err
                            ? ((await (err as { response: Response }).response
                                .json()
                                .catch(() => ({}))) as { message?: string })
                            : {};
                        Alert.alert(
                          "Can't update slots",
                          body.message ?? "Failed to update slot count.",
                        );
                      },
                    });
                  }}
                  disabled={disabled && !isSelected}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.slotOptionText,
                      isSelected && styles.slotOptionTextSelected,
                      disabled && !isSelected && styles.slotOptionTextDisabled,
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <Text style={styles.slotControlHint}>
              {group.maxMembers - totalSlots + mySlots} open
            </Text>
          </View>
        </View>
      )}

      {/* Slot offer banner — shown to member who has a pending extra slot */}
      {hasSlotOffer && (
        <View style={styles.slotOfferBanner}>
          <View style={styles.slotOfferIconWrap}>
            <MaterialCommunityIcons
              name="hand-coin"
              size={20}
              color={colors.primary}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.slotOfferTitle}>Extra slot offered</Text>
            <Text style={styles.slotOfferSub}>
              The admin has offered you an additional position in this group.
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            <TouchableOpacity
              style={[
                styles.slotOfferBtn,
                (acceptOffer.isPending || declineOffer.isPending) && {
                  opacity: 0.6,
                },
              ]}
              onPress={() =>
                acceptOffer.mutate(1, {
                  onSuccess: () =>
                    router.replace({
                      pathname: "/payment-success",
                      params: {
                        type: "slot-accepted",
                        groupId: id,
                        groupName: group?.name ?? "",
                      },
                    } as never),
                })
              }
              disabled={acceptOffer.isPending || declineOffer.isPending}
            >
              <Text style={styles.slotOfferBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                declineOffer.mutate(undefined, {
                  onSuccess: () =>
                    router.replace({
                      pathname: "/payment-success",
                      params: {
                        type: "slot-declined",
                        groupName: group?.name ?? "",
                      },
                    } as never),
                })
              }
              disabled={acceptOffer.isPending || declineOffer.isPending}
            >
              <Text style={styles.slotOfferDecline}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Invite banner — shown for admin on a DRAFT group */}
      {isAdmin && group.status === "DRAFT" && canInvite && (
        <View style={styles.inviteBanner}>
          <View style={styles.inviteBannerTop}>
            <View>
              <Text style={styles.inviteBannerTitle}>
                Invite members to start
              </Text>
              <Text style={styles.inviteBannerSub}>
                {group.members.length} of {group.maxMembers} spots filled
              </Text>
            </View>

            <TouchableOpacity
              style={styles.inviteBannerBtn}
              onPress={openInvite}
              activeOpacity={0.85}
            >
              <Text style={styles.inviteBannerBtnText}>+ Invite</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inviteProgress}>
            <View
              style={[
                styles.inviteProgressFill,
                {
                  width: `${Math.round((group.members.length / group.maxMembers) * 100)}%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Start date + start group — admin only, DRAFT */}
      {isAdmin && isDraft && (
        <View style={styles.startCard}>
          <View style={styles.startCardRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.startCardLabel}>Start date</Text>
              <Text style={styles.startCardValue}>
                {group.startDate
                  ? new Date(group.startDate).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Not set"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.startCardEditBtn}
              onPress={() => {
                setDateInput(
                  group.startDate
                    ? new Date(group.startDate).toISOString().slice(0, 10)
                    : "",
                );
                setDatePickerOpen(true);
              }}
            >
              <Text style={styles.startCardEditBtnText}>
                {group.startDate ? "Change" : "Set date"}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.startGroupBtn,
              !canStart && styles.startGroupBtnDisabled,
            ]}
            onPress={handleStartGroup}
            disabled={!canStart || startGroup.isPending}
            activeOpacity={0.8}
          >
            {startGroup.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.startGroupBtnText}>
                {!group.startDate
                  ? "Set a start date first"
                  : activeMembers.length < 2
                    ? "Need at least 2 active members"
                    : "Start group"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Delete group — admin only, not while ACTIVE */}
      {canDelete && (
        <TouchableOpacity
          style={styles.deleteGroupBtn}
          onPress={handleDeleteGroup}
          disabled={deleteGroup.isPending}
          activeOpacity={0.7}
        >
          {deleteGroup.isPending ? (
            <ActivityIndicator color={colors.destructive} size="small" />
          ) : (
            <Text style={styles.deleteGroupBtnText}>Delete group</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {(
          ["cycles", "members", "activity", "payouts", "penalties"] as Tab[]
        ).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabItem, tab === t && styles.tabItemActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "cycles"
                ? "Cycles"
                : t === "members"
                  ? "Members"
                  : t === "activity"
                    ? "Activity"
                    : t === "payouts"
                      ? "Payouts"
                      : "Penalties"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              void refetch();
              void refetchHistory();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {tab === "cycles" && (
          <CyclesTab cycles={group.cycles} myMemberId={myMember?.id} />
        )}
        {tab === "members" && (
          <MembersTab
            members={group.members}
            history={history}
            groupId={group.id}
            groupStatus={group.status}
            isAdmin={isAdmin}
            isDraft={isDraft}
            adminId={group.adminId}
            currentUserId={me?.id}
            maxMembers={group.maxMembers}
            totalSlots={totalSlots}
            onSelectMember={(m, slots) => {
              setSelectedMember(m);
              setSelectedMemberSlots(slots);
            }}
            onOfferSlot={(userId, memberName) => {
              Alert.alert(
                "Offer extra slot",
                `Offer an additional rotation slot to ${memberName}? They'll need to accept it before it's confirmed.`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Send offer",
                    onPress: () =>
                      offerSlot.mutate(userId, {
                        onSuccess: () => void refetch(),
                        onError: async (err: unknown) => {
                          const body =
                            err && typeof err === "object" && "response" in err
                              ? ((await (err as { response: Response }).response
                                  .json()
                                  .catch(() => ({}))) as { message?: string })
                              : {};
                          Alert.alert(
                            "Can't offer slot",
                            body.message ?? "Failed to offer slot.",
                          );
                        },
                      }),
                  },
                ],
              );
            }}
          />
        )}
        {tab === "activity" && <ActivityTab history={history} />}
        {tab === "payouts" && <PayoutsTab payouts={history?.payouts ?? []} />}
        {tab === "penalties" && (
          <PenaltiesTab penalties={history?.penalties ?? []} />
        )}
      </ScrollView>

      {/* Date picker modal */}
      <Modal
        visible={datePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDatePickerOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(0,0,0,0.4)" },
            ]}
            activeOpacity={1}
            onPress={() => setDatePickerOpen(false)}
          />
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <View style={styles.datePickerSheet}>
              <Text style={styles.datePickerTitle}>Set start date</Text>
              <TextInput
                style={styles.datePickerInput}
                value={dateInput}
                onChangeText={setDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                maxLength={10}
                autoFocus
              />
              <Text style={styles.datePickerHint}>e.g. 2025-08-15</Text>
              <TouchableOpacity
                style={[
                  styles.datePickerSave,
                  updateGroup.isPending && { opacity: 0.6 },
                ]}
                onPress={handleSaveDate}
                disabled={updateGroup.isPending}
              >
                {updateGroup.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.datePickerSaveText}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.datePickerCancel}
                onPress={() => setDatePickerOpen(false)}
              >
                <Text style={styles.datePickerCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Invite modal */}
      <Modal
        visible={inviteOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.backdropArea}
            onPress={() => setInviteOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Invite a member</Text>
            <Text style={styles.sheetSub}>
              Send an invite to {group.name} via phone or email.
            </Text>

            {/* Mode toggle */}
            <View style={styles.modeToggle}>
              {(["phone", "email"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.modeBtn,
                    inviteMode === m && styles.modeBtnActive,
                  ]}
                  onPress={() => {
                    setInviteMode(m);
                    setInviteValue("");
                    setInviteSuccess(null);
                  }}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      inviteMode === m && styles.modeBtnTextActive,
                    ]}
                  >
                    {m === "phone" ? "Phone" : "Email"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {inviteSuccess ? (
              <View style={styles.successBox}>
                <Text style={styles.successMsg}>✓ {inviteSuccess.message}</Text>
                <Text style={styles.successHint}>Share this invite link:</Text>
                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={() => {
                    void Share.share({
                      message: `Join my savings circle on Poolr: poolr://join?token=${inviteSuccess.token}`,
                    });
                  }}
                >
                  <Text style={styles.shareBtnText}>Share invite link</Text>
                </TouchableOpacity>
                <Pressable
                  style={styles.inviteAnother}
                  onPress={() => {
                    setInviteSuccess(null);
                    setInviteValue("");
                  }}
                >
                  <Text style={styles.inviteAnotherText}>Invite another</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.inviteInput}
                  value={inviteValue}
                  onChangeText={setInviteValue}
                  placeholder={
                    inviteMode === "phone"
                      ? "+2348012345678"
                      : "member@example.com"
                  }
                  placeholderTextColor={colors.textMuted}
                  keyboardType={
                    inviteMode === "phone" ? "phone-pad" : "email-address"
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  style={[
                    styles.sheetBtn,
                    (!inviteValue.trim() || inviteMember.isPending) &&
                      styles.sheetBtnDisabled,
                  ]}
                  onPress={handleInvite}
                  disabled={!inviteValue.trim() || inviteMember.isPending}
                >
                  {inviteMember.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.sheetBtnText}>Send invite</Text>
                  )}
                </Pressable>
              </>
            )}

            <Pressable
              style={styles.cancelBtn}
              onPress={() => setInviteOpen(false)}
            >
              <Text style={styles.cancelBtnText}>Close</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Member profile sheet */}
      {selectedMember && (
        <MemberProfileSheet
          member={selectedMember}
          slots={selectedMemberSlots}
          history={history}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </View>
  );
}

function CyclesTab({
  cycles,
  myMemberId,
}: {
  cycles: Cycle[];
  myMemberId?: string;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (cycles.length === 0) {
    return <EmptyState text="No cycles have started yet." />;
  }

  const completedCount = cycles.filter((c) => c.status === "COMPLETED").length;

  return (
    <View style={styles.list}>
      {completedCount > 0 && (
        <View style={styles.cyclesSummary}>
          <Text style={styles.cyclesSummaryText}>
            {completedCount}/{cycles.length} cycles completed
          </Text>
          <View style={styles.cyclesProgressBar}>
            <View
              style={[
                styles.cyclesProgressFill,
                {
                  width: `${Math.round((completedCount / cycles.length) * 100)}%`,
                },
              ]}
            />
          </View>
        </View>
      )}
      {cycles.map((cycle) => {
        const myContrib = myMemberId
          ? cycle.contributions?.find((c) => c.memberId === myMemberId)
          : undefined;
        const isPaid = myContrib?.status === "PAID";
        const isActive =
          cycle.status === "ACTIVE" || cycle.status === "IN_PROGRESS";

        return (
          <View
            key={cycle.id}
            style={[styles.cycleCard, isActive && styles.cycleCardActive]}
          >
            <View style={styles.cycleHeader}>
              <View
                style={[
                  styles.cycleNumber,
                  isActive && styles.cycleNumberActive,
                ]}
              >
                <Text
                  style={[
                    styles.cycleNumberText,
                    isActive && styles.cycleNumberTextActive,
                  ]}
                >
                  {cycle.cycleNumber}
                </Text>
              </View>
              <View style={styles.cycleMeta}>
                <Text style={styles.cycleTitle}>Cycle {cycle.cycleNumber}</Text>
                <Text style={styles.cycleDue}>
                  Due {formatDate(cycle.dueDate)}
                </Text>
                {cycle.recipientMember && (
                  <Text style={styles.cycleRecipient}>
                    Payout → {cycle.recipientMember.user.fullName}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <CycleBadge status={cycle.status} />
                {isPaid && <Text style={styles.myStatus}>✓ Paid</Text>}
              </View>
            </View>

            {cycle.contributions && cycle.contributions.length > 0 && (
              <View style={styles.contribProgress}>
                <Text style={styles.contribProgressText}>
                  {
                    cycle.contributions.filter((c) => c.status === "PAID")
                      .length
                  }
                  /{cycle.contributions.length} paid
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${(cycle.contributions.filter((c) => c.status === "PAID").length / cycle.contributions.length) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function CycleBadge({ status }: { status: string }) {
  const variantMap: Record<string, { variant: BadgeVariant; label: string }> = {
    ACTIVE: { variant: "success", label: "Active" },
    IN_PROGRESS: { variant: "info", label: "In Progress" },
    COMPLETED: { variant: "completed", label: "Completed" },
    PENDING: { variant: "warning", label: "Pending" },
    SKIPPED: { variant: "neutral", label: "Skipped" },
  };
  const { variant, label } = variantMap[status] ?? {
    variant: "neutral" as BadgeVariant,
    label: status,
  };
  return <StatusBadge label={label} variant={variant} />;
}

function MembersTab({
  members,
  history,
  groupId,
  groupStatus,
  isAdmin,
  isDraft,
  adminId,
  currentUserId,
  maxMembers,
  totalSlots,
  onSelectMember,
  onOfferSlot,
}: {
  members: GroupMember[];
  history: GroupHistory | undefined;
  groupId: string;
  groupStatus: string;
  isAdmin: boolean;
  isDraft: boolean;
  adminId: string;
  currentUserId?: string;
  maxMembers: number;
  totalSlots: number;
  onSelectMember: (m: GroupMember, slots: number) => void;
  onOfferSlot: (userId: string, memberName: string) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const removeMember = useRemoveMember(groupId);

  const uniqueMembers = useMemo(() => {
    const map = new Map<
      string,
      { member: GroupMember; slots: number; hasOffer: boolean }
    >();
    for (const m of members) {
      const existing = map.get(m.userId);
      if (existing) {
        existing.slots += 1;
        if (m.memberStatus === "INVITED") existing.hasOffer = true;
      } else {
        map.set(m.userId, {
          member: m,
          slots: 1,
          hasOffer: m.memberStatus === "INVITED",
        });
      }
    }
    return Array.from(map.values());
  }, [members]);

  if (members.length === 0) {
    return <EmptyState text="No members yet." />;
  }
  return (
    <View style={styles.list}>
      {uniqueMembers.map(({ member: m, slots, hasOffer }) => {
        const canOffer =
          isAdmin &&
          isDraft &&
          m.userId !== adminId &&
          !hasOffer &&
          totalSlots < maxMembers &&
          slots < 3;
        const canRemove =
          isAdmin &&
          groupStatus !== "ACTIVE" &&
          m.userId !== adminId &&
          m.userId !== currentUserId;
        return (
          <TouchableOpacity
            key={m.userId}
            style={styles.memberRow}
            onPress={() => onSelectMember(m, slots)}
            activeOpacity={0.7}
          >
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>
                {initials(m.user.fullName)}
              </Text>
            </View>
            <View style={styles.memberInfo}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={styles.memberName}>{m.user.fullName}</Text>
                {m.userId === adminId && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
              </View>
              <Text style={styles.memberEmail}>{m.user.email}</Text>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              {slots > 1 && (
                <View style={styles.slotsBadge}>
                  <MaterialCommunityIcons
                    name="hand-coin"
                    size={12}
                    color={colors.primaryLight}
                  />
                  <Text style={styles.slotsBadgeText}>{slots}</Text>
                </View>
              )}
              {canOffer ? (
                <TouchableOpacity
                  style={styles.offerSlotBtn}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onOfferSlot(m.userId, m.user.fullName);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="hand-coin"
                    size={12}
                    color={colors.primary}
                  />
                  <Text style={styles.offerSlotBtnText}>Offer slot</Text>
                </TouchableOpacity>
              ) : (
                <>
                  {m.memberStatus === "ACTIVE" ? (
                    <></>
                  ) : (
                    <StatusBadge
                      label={m.memberStatus === "ACTIVE" ? "Active" : "Invited"}
                      variant={
                        m.memberStatus === "ACTIVE" ? "success" : "warning"
                      }
                    />
                  )}
                </>
              )}
              {canRemove && (
                <TouchableOpacity
                  style={styles.removeMemberBtn}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    Alert.alert(
                      "Remove member",
                      `Remove ${m.user.fullName} from this group?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () => removeMember.mutate(m.id),
                        },
                      ],
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Feather name="trash-2" size={14} color={colors.dangerText} />
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MemberProfileSheet({
  member,
  slots,
  history,
  onClose,
}: {
  member: GroupMember;
  slots: number;
  history: GroupHistory | undefined;
  onClose: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const contribs =
    history?.contributions.filter((c) => c.memberId === member.id) ?? [];
  const paid = contribs.filter((c) => c.status === "PAID");
  const onTimePaid = paid.filter(
    (c) => c.paidAt && c.dueAt && new Date(c.paidAt) <= new Date(c.dueAt),
  );
  const onTimeRate =
    paid.length > 0
      ? Math.round((onTimePaid.length / paid.length) * 100)
      : null;
  const penalties =
    history?.penalties.filter(
      (p) => p.memberId === member.id && p.status === "APPLIED",
    ) ?? [];

  const isVerified = member.user.kycProfile?.kycStatus === "VERIFIED";
  const tc =
    member.tier && member.tier !== "NEW" ? tierConfig(member.tier) : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdropArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          {/* Avatar + name + badges */}
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatarLg}>
              <Text style={styles.profileAvatarLgText}>
                {initials(member.user.fullName)}
              </Text>
            </View>
            <Text style={styles.profileNameLg}>{member.user.fullName}</Text>
            <View
              style={{
                flexDirection: "row",
                gap: 6,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {isVerified ? (
                <StatusBadge label="✓ Verified" variant="success" />
              ) : (
                <StatusBadge label="Unverified" variant="danger" />
              )}
              {slots > 1 && (
                <View
                  style={[
                    styles.slotsBadge,
                    { paddingHorizontal: 8, paddingVertical: 3 },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="hand-coin"
                    size={13}
                    color={colors.primary}
                  />
                  <Text style={[styles.slotsBadgeText, { fontSize: 12 }]}>
                    {slots} slots
                  </Text>
                </View>
              )}
              {tc && (
                <View
                  style={[
                    styles.tierBadge,
                    {
                      backgroundColor: tc.bg,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    },
                  ]}
                >
                  <Feather name={tc.icon} size={11} color={tc.color} />
                  <Text
                    style={[
                      styles.tierBadgeText,
                      { color: tc.color, fontSize: 12 },
                    ]}
                  >
                    {tc.label}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Details */}
          <View style={styles.profileSection}>
            <Text style={styles.profileSectionTitle}>Details</Text>
            {member.user.phone && (
              <View style={styles.profileRow}>
                <Text style={styles.profileRowIcon}>📞</Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${member.user.phone}`)}
                  onLongPress={() =>
                    Share.share({ message: member.user.phone! })
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.profileRowText,
                      { textDecorationLine: "underline" },
                    ]}
                  >
                    {member.user.phone}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.profileRow}>
              <Text style={styles.profileRowIcon}>✉️</Text>
              <TouchableOpacity
                onPress={() => Share.share({ message: member.user.email })}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.profileRowText,
                    { textDecorationLine: "underline" },
                  ]}
                >
                  {member.user.email}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileRowIcon}>📅</Text>
              <Text style={styles.profileRowText}>
                Joined {formatDate(member.joinedAt)}
              </Text>
            </View>
          </View>

          {/* Reliability */}
          <View style={styles.profileSection}>
            <Text style={styles.profileSectionTitle}>Reliability</Text>
            {contribs.length === 0 ? (
              <Text
                style={[
                  styles.profileRowText,
                  { color: colors.textMuted, paddingLeft: 4 },
                ]}
              >
                No contributions yet
              </Text>
            ) : (
              <>
                <View style={styles.profileRow}>
                  <Text style={styles.profileRowIcon}>💳</Text>
                  <Text style={styles.profileRowText}>
                    {paid.length} contribution{paid.length !== 1 ? "s" : ""}{" "}
                    paid
                  </Text>
                </View>
                {onTimeRate !== null && (
                  <View style={styles.profileRow}>
                    <Text style={styles.profileRowIcon}>⏱</Text>
                    <Text
                      style={[
                        styles.profileRowText,
                        {
                          color:
                            onTimeRate === 100
                              ? "#166534"
                              : onTimeRate >= 75
                                ? "#854d0e"
                                : "#b91c1c",
                          fontWeight: "600",
                        },
                      ]}
                    >
                      {onTimeRate}% on time
                    </Text>
                  </View>
                )}
                {penalties.length > 0 && (
                  <View style={styles.profileRow}>
                    <Text style={styles.profileRowIcon}>⚠️</Text>
                    <Text style={[styles.profileRowText, { color: "#b91c1c" }]}>
                      {penalties.length} penalt
                      {penalties.length !== 1 ? "ies" : "y"}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Close</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ActivityTab({ history }: { history: GroupHistory | undefined }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const contribs = history?.contributions ?? [];
  const payouts = history?.payouts ?? [];

  type ActivityItem = {
    id: string;
    label: string;
    amount: string;
    date: string;
  };
  const items: ActivityItem[] = [
    ...contribs.map((c) => ({
      id: c.id,
      label: `${c.member.user.fullName} contributed ${formatCurrency(c.amount)}`,
      amount: c.amount,
      date: c.createdAt,
    })),
    ...payouts.map((p) => ({
      id: p.id,
      label: `${p.recipient.fullName} received ${formatCurrency(p.amount)}`,
      amount: p.amount,
      date: p.createdAt,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (items.length === 0) {
    return <EmptyState text="No activity yet." />;
  }
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item.id} style={styles.activityRow}>
          <View style={styles.activityInfo}>
            <Text style={styles.activityDesc}>{item.label}</Text>
            <Text style={styles.activityDate}>{timeAgo(item.date)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function PayoutsTab({ payouts }: { payouts: GroupHistory["payouts"] }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (payouts.length === 0) {
    return <EmptyState text="No payouts yet." />;
  }
  const PAYOUT_VARIANT: Record<
    string,
    { variant: BadgeVariant; label: string }
  > = {
    PENDING: { variant: "warning", label: "Pending" },
    INITIATED: { variant: "info", label: "Initiated" },
    COMPLETED: { variant: "success", label: "Completed" },
    FAILED: { variant: "danger", label: "Failed" },
  };
  return (
    <View style={styles.list}>
      {payouts.map((p) => {
        const cfg = PAYOUT_VARIANT[p.status] ?? PAYOUT_VARIANT.PENDING;
        return (
          <View key={p.id} style={styles.payoutRow}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.payoutRecipient}>{p.recipient.fullName}</Text>
              <Text style={styles.payoutMeta}>
                Cycle {p.cycle.cycleNumber} · {timeAgo(p.createdAt)}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <Text style={[styles.activityAmount, styles.credit]}>
                {formatCurrency(p.amount)}
              </Text>
              <StatusBadge label={cfg.label} variant={cfg.variant} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PenaltiesTab({ penalties }: { penalties: GroupHistory["penalties"] }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (penalties.length === 0) {
    return <EmptyState text="No penalties recorded." />;
  }
  const PENALTY_VARIANT: Record<
    string,
    { variant: BadgeVariant; label: string }
  > = {
    PENDING: { variant: "warning", label: "Pending" },
    APPLIED: { variant: "danger", label: "Applied" },
    WAIVED: { variant: "neutral", label: "Waived" },
  };
  return (
    <View style={styles.list}>
      {penalties.map((p) => {
        const cfg = PENALTY_VARIANT[p.status] ?? PENALTY_VARIANT.PENDING;
        return (
          <View key={p.id} style={styles.payoutRow}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.payoutRecipient}>
                {p.member.user.fullName}
              </Text>
              <Text style={styles.payoutMeta}>
                {p.reason === "MISSED_PAYMENT" ? "Missed payment" : p.reason} ·
                Cycle {p.contribution.cycle.cycleNumber}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <Text style={[styles.activityAmount, styles.debit]}>
                {formatCurrency(p.penaltyAmount)}
              </Text>
              <StatusBadge label={cfg.label} variant={cfg.variant} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );
}

function createStyles(colors: import("@/lib/colors").Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    loadingRoot: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 16,
      paddingTop: 56,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    back: { marginBottom: 8 },
    backText: { fontSize: 15, color: colors.primary, fontWeight: "600" },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    headerInfo: { flex: 1, gap: 3 },
    inviteBanner: {
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: colors.primaryBg,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      gap: 10,
    },
    inviteBannerTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    inviteBannerTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primaryText,
    },
    inviteBannerSub: {
      fontSize: 12,
      color: colors.primaryTextMid,
      marginTop: 2,
    },
    inviteBannerBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 10,
    },
    inviteBannerBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    inviteProgress: {
      height: 6,
      backgroundColor: colors.primaryBorder,
      borderRadius: 3,
      overflow: "hidden",
    },
    inviteProgressFill: {
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    inviteBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    inviteBtnText: { fontSize: 13, fontWeight: "700", color: colors.primary },
    groupName: { fontSize: 22, fontWeight: "600", color: colors.text },
    groupMeta: { fontSize: 13, color: colors.textMuted },

    payCta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.primaryBg,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.primaryBorder,
    },
    payCtaTitle: { fontSize: 13, fontWeight: "700", color: colors.primaryText },
    payCtaDate: { fontSize: 12, color: colors.primaryTextMid, marginTop: 1 },
    payBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    payBtnDisabled: { opacity: 0.6 },
    payBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    payCtaFee: { fontSize: 11, color: colors.primaryTextMid, marginTop: 2 },
    walletBtn: {
      backgroundColor: "rgba(255,255,255,0.15)",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
    },
    walletBtnDisabled: { opacity: 0.45 },
    walletBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    walletBtnTextDisabled: { opacity: 0.6 },
    feeModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
    feeModalSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      paddingBottom: 36,
      gap: 16,
    },
    feeModalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: 8,
    },
    feeModalTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    feeBreakdown: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    feeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    feeRowLabel: { fontSize: 14, color: colors.textMuted },
    feeRowValue: { fontSize: 14, fontWeight: "500", color: colors.text },
    feeRowTotal: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
      marginTop: 2,
    },
    feeRowTotalLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
    feeRowTotalValue: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.primary,
    },
    methodLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 4,
    },
    methodOption: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      gap: 4,
    },
    methodOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryBg ?? colors.card,
    },
    methodOptionDisabled: { opacity: 0.5 },
    methodRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    methodName: { fontSize: 14, fontWeight: "600", color: colors.text },
    methodAmount: { fontSize: 14, fontWeight: "700", color: colors.text },
    methodSub: { fontSize: 12, color: colors.textMuted },
    feeModalActions: { flexDirection: "row", gap: 12, marginTop: 4 },
    feeCancelBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
    },
    feeCancelBtnText: { fontSize: 15, fontWeight: "600", color: colors.text },
    feeConfirmBtn: {
      flex: 2,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
    },
    feeConfirmBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    paystackBadge: {
      fontSize: 10,
      color: colors.primaryTextMid,
      fontWeight: "500",
    },

    vaCard: {
      backgroundColor: colors.primaryBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.primaryBorder,
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 2,
    },
    vaLabel: {
      fontSize: 11,
      color: colors.primaryTextMid,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    vaAccount: { fontSize: 14, fontWeight: "700", color: colors.primaryText },
    vaSub: { fontSize: 12, color: colors.primaryTextMid },

    tabs: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabItem: { flex: 1, paddingVertical: 10, alignItems: "center" },
    tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabText: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
    tabTextActive: { color: colors.primary },

    scrollView: { flex: 1 },
    scrollContent: { padding: 16, gap: 10 },
    list: { gap: 10 },

    cycleCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    cycleCardActive: {
      borderColor: colors.primary + "60",
      backgroundColor: colors.primaryBg,
    },
    cycleHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    cycleNumber: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    cycleNumberActive: { backgroundColor: colors.primary },
    cycleNumberText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textMuted,
    },
    cycleNumberTextActive: { color: "#fff" },
    cycleMeta: { flex: 1, gap: 2 },
    cycleTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
    cycleDue: { fontSize: 12, color: colors.textMuted },
    cycleRecipient: { fontSize: 12, color: colors.primary, fontWeight: "600" },
    myStatus: { fontSize: 11, color: colors.successText, fontWeight: "700" },
    miniPayBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 7,
    },
    miniPayBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },

    contribProgress: { gap: 5 },
    contribProgressText: { fontSize: 11, color: colors.textMuted },
    progressBar: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 99,
    },
    progressFill: {
      height: 4,
      backgroundColor: colors.primary,
      borderRadius: 99,
    },

    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.successBg,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    memberAvatarText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
    },
    memberInfo: { flex: 1, gap: 2 },
    memberName: { fontSize: 14, fontWeight: "600", color: colors.text },
    memberEmail: { fontSize: 12, color: colors.textMuted },
    memberPhone: { fontSize: 12, color: colors.textMuted },
    tierBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99 },
    tierBadgeText: { fontSize: 10, fontWeight: "700" },
    slotsBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 99,
      backgroundColor: colors.primaryBg,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    slotsBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primaryLight,
    },
    offerSlotBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primaryBg,
    },
    offerSlotBtnText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
    },
    adminBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 99,
      backgroundColor: colors.primaryBg,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    adminBadgeText: { fontSize: 10, fontWeight: "700", color: colors.primary },

    profileHeader: { alignItems: "center", gap: 8, paddingBottom: 4 },
    profileAvatarLg: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.successBg,
      alignItems: "center",
      justifyContent: "center",
    },
    profileAvatarLgText: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.primary,
    },
    profileNameLg: { fontSize: 20, fontWeight: "700", color: colors.text },
    profileSection: { gap: 8 },
    profileSectionTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    profileRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    profileRowIcon: { fontSize: 15, width: 22, textAlign: "center" },
    profileRowText: { fontSize: 14, color: colors.text, flex: 1 },
    cyclesSummary: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    cyclesSummaryText: { fontSize: 13, fontWeight: "600", color: colors.text },
    cyclesProgressBar: {
      height: 5,
      backgroundColor: colors.border,
      borderRadius: 99,
    },
    cyclesProgressFill: {
      height: 5,
      backgroundColor: colors.primary,
      borderRadius: 99,
    },

    activityRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    activityIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    activityIconCredit: { backgroundColor: colors.successBg },
    activityIconDebit: { backgroundColor: colors.dangerBg },
    activityInfo: { flex: 1, gap: 2 },
    activityDesc: { fontSize: 13, fontWeight: "600", color: colors.text },
    activityDate: { fontSize: 12, color: colors.textMuted },
    activityAmount: { fontSize: 14, fontWeight: "700" },
    credit: { color: colors.successText },
    debit: { color: colors.dangerText },

    payoutRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    payoutRecipient: { fontSize: 14, fontWeight: "600", color: colors.text },
    payoutMeta: { fontSize: 12, color: colors.textMuted },

    slotControlCard: {
      marginHorizontal: 16,
      marginVertical: 8,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    slotControlTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    slotControlSub: { fontSize: 12, color: colors.textMuted },
    slotControlRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    slotOption: {
      width: 44,
      height: 44,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    slotOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    slotOptionDisabled: { opacity: 0.35 },
    slotOptionText: { fontSize: 15, fontWeight: "700", color: colors.text },
    slotOptionTextSelected: { color: "#fff" },
    slotOptionTextDisabled: { color: colors.textMuted },
    slotControlHint: { fontSize: 12, color: colors.textMuted, marginLeft: 4 },

    slotOfferBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: colors.primaryBg,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    slotOfferIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    slotOfferTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primaryText,
    },
    slotOfferSub: { fontSize: 12, color: colors.primaryTextMid },
    slotOfferBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      alignItems: "center",
    },
    slotOfferBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    slotOfferDecline: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
    },

    emptyState: { paddingVertical: 40, alignItems: "center" },
    emptyStateText: { fontSize: 14, color: colors.textMuted },

    modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
    backdropArea: { flex: 1 },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === "ios" ? 32 : 24,
      paddingTop: 12,
      gap: 14,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: 4,
    },
    sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    sheetSub: { fontSize: 14, color: colors.textMuted, marginTop: -8 },
    modeToggle: {
      flexDirection: "row",
      gap: 8,
      padding: 4,
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: 9,
    },
    modeBtnActive: { backgroundColor: colors.primary },
    modeBtnText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
    modeBtnTextActive: { color: "#fff" },
    inviteInput: {
      height: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.inputBg,
    },
    sheetBtn: {
      height: 48,
      backgroundColor: colors.primary,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetBtnDisabled: { opacity: 0.5 },
    sheetBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    cancelBtn: { alignItems: "center", paddingVertical: 4 },
    cancelBtnText: { fontSize: 14, color: colors.textMuted },
    successBox: { gap: 12 },
    successMsg: { fontSize: 14, fontWeight: "700", color: colors.successText },
    successHint: { fontSize: 13, color: colors.textMuted },
    shareBtn: {
      height: 44,
      backgroundColor: colors.primaryBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    shareBtnText: { fontSize: 14, fontWeight: "700", color: colors.primary },
    inviteAnother: { alignItems: "center", paddingVertical: 4 },
    inviteAnotherText: {
      fontSize: 13,
      color: colors.textMuted,
      textDecorationLine: "underline",
    },

    // Start date + start group card
    startCard: {
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    startCardRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    startCardLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
    startCardValue: { fontSize: 15, fontWeight: "600", color: colors.text },
    startCardEditBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primaryBg,
    },
    startCardEditBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.primaryText,
    },
    startGroupBtn: {
      height: 44,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    startGroupBtnDisabled: { opacity: 0.45 },
    startGroupBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    deleteGroupBtn: {
      marginHorizontal: 16,
      marginBottom: 8,
      height: 44,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerBg + "20",
    },
    deleteGroupBtnText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.dangerText,
    },
    removeMemberBtn: {
      width: 28,
      height: 28,
      // borderRadius: 6,
      // borderWidth: 1,
      // borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerBg + "20",
      alignItems: "center",
      justifyContent: "center",
    },

    // Date picker modal
    datePickerSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      gap: 16,
    },
    datePickerTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
    datePickerInput: {
      height: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.inputBg,
      letterSpacing: 1,
    },
    datePickerHint: { fontSize: 12, color: colors.textMuted, marginTop: -8 },
    datePickerSave: {
      height: 46,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    datePickerSaveText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    datePickerCancel: { alignItems: "center", paddingVertical: 8 },
    datePickerCancelText: { fontSize: 14, color: colors.textMuted },
  });
}
