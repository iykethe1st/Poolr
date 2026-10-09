import { useState, useMemo, useRef } from "react";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
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
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextProps as NativeTextProps,
  type TextStyle,
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
import { Text as ThemeText, type TextTone } from "@/components/ui/text";
import type { Cycle, GroupMember, GroupHistory } from "@/hooks/use-group";
import { radii, spacing, typography, type TypographyVariant } from "@/theme";

type Tab = "cycles" | "members" | "activity" | "payouts" | "penalties";

type GroupTextProps = NativeTextProps & {
  tabularNumbers?: boolean;
  tone?: TextTone;
  variant?: TypographyVariant;
};

function Text({
  style,
  tabularNumbers,
  tone,
  variant,
  ...props
}: GroupTextProps) {
  const colors = useColors();
  const flattenedStyle = StyleSheet.flatten(style) ?? {};
  const requestedVariant =
    variant ?? variantForFontSize(flattenedStyle.fontSize);
  const requestedTone =
    tone ?? toneForColor(flattenedStyle.color, colors) ?? "primary";
  const {
    color: _color,
    fontSize: _fontSize,
    fontWeight: _fontWeight,
    letterSpacing: _letterSpacing,
    lineHeight: _lineHeight,
    ...layoutStyle
  } = flattenedStyle;

  return (
    <ThemeText
      {...props}
      variant={requestedVariant}
      tone={requestedTone}
      tabularNumbers={tabularNumbers}
      style={layoutStyle}
    />
  );
}

function variantForFontSize(
  fontSize: TextStyle["fontSize"],
): TypographyVariant {
  if (typeof fontSize !== "number") return "body";
  if (fontSize <= 11) return "overline";
  if (fontSize <= 13) return "caption";
  if (fontSize <= 16) return "body";
  if (fontSize <= 19) return "headline";
  if (fontSize <= 22) return "title2";
  if (fontSize <= 30) return "title1";
  return "display";
}

function toneForColor(
  color: TextStyle["color"],
  colors: ReturnType<typeof useColors>,
): TextTone | undefined {
  if (typeof color !== "string") return;
  if (color === colors.textPrimary) return "primary";
  if (color === colors.textSecondary || color === colors.textMuted)
    return "secondary";
  if (color === colors.textTertiary) return "tertiary";
  if (color === colors.textOnPrimary) return "onPrimary";
  if (color === colors.textInverse) return "inverse";
  if (color === colors.primary || color === colors.primaryText) return "brand";
  if (color === colors.success || color === colors.successText)
    return "success";
  if (color === colors.warning || color === colors.warningText)
    return "warning";
  if (color === colors.danger || color === colors.dangerText) return "danger";
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("cycles");
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);

  const { data: group, isLoading, refetch } = useGroupDetail(id);
  const {
    data: history,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useGroupHistory(id);
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const successNavigationStarted = useRef(false);

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function navigateToSuccess(
    amount: number | undefined,
    groupId: string | undefined,
    groupName: string | undefined,
  ): Promise<void> {
    if (successNavigationStarted.current) return;
    successNavigationStarted.current = true;
    await Promise.all([refetch(), refetchHistory()]);
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
    successNavigationStarted.current = false;
    try {
      const result = await initContrib.mutateAsync({ cycleId, useWallet });

      if (useWallet || !result.authorizationUrl) {
        await navigateToSuccess(result.totalChargedNgn, group?.id, group?.name);
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
              await navigateToSuccess(
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
            await navigateToSuccess(
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

  async function handleSaveDate(date?: Date) {
    const d = date ?? selectedDate;
    const dateStr = d.toISOString().split("T")[0];
    updateGroup.mutate(
      { startDate: dateStr },
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.back}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text variant="title1" style={styles.groupName}>
              {group.name}
            </Text>
            <Text variant="body" tone="secondary" style={styles.groupMeta}>
              {group.members.length} of {group.maxMembers} members
            </Text>
          </View>
          {canInvite && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Invite a member"
              style={styles.inviteBtn}
              onPress={openInvite}
            >
              <Text
                variant="bodyStrong"
                tone="brand"
                style={styles.inviteBtnText}
              >
                + Invite
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.groupSummary}>
          <View style={styles.groupSummaryItem}>
            <Text variant="caption" tone="secondary">
              Contribution
            </Text>
            <Text variant="bodyStrong" tabularNumbers>
              {formatCurrency(group.contributionAmount)}
            </Text>
          </View>
          <View style={styles.groupSummaryDivider} />
          <View style={styles.groupSummaryItem}>
            <Text variant="caption" tone="secondary">
              Schedule
            </Text>
            <Text variant="bodyStrong">{group.frequency.toLowerCase()}</Text>
          </View>
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
                <View style={styles.paystackBadgeRow}>
                  <Feather
                    name="lock"
                    size={12}
                    color={colors.iconMuted}
                    accessibilityElementsHidden
                  />
                  <Text variant="caption" tone="secondary">
                    Secured by Paystack
                  </Text>
                </View>
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
                      <Text style={styles.feeRowValue} tabularNumbers>
                        {formatCurrency(group.contributionAmount)}
                      </Text>
                    </View>
                    <View style={styles.feeRow}>
                      <Text style={styles.feeRowLabel}>Platform fee</Text>
                      <Text style={styles.feeRowValue} tabularNumbers>
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
                          tabularNumbers
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
                      <Text style={styles.methodAmount} tabularNumbers>
                        {formatCurrency(cardTotal)}
                      </Text>
                    </View>
                    <Text style={styles.methodSub} tabularNumbers>
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
                        tabularNumbers
                      >
                        {formatCurrency(totalAmountNgn)}
                      </Text>
                    </View>
                    <Text style={styles.methodSub} tabularNumbers>
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
                        <ActivityIndicator
                          color={colors.textOnPrimary}
                          size="small"
                        />
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
          {/* Header */}
          <View style={styles.slotControlHeader}>
            <View style={styles.slotControlIconWrap}>
              <MaterialCommunityIcons
                name="hand-coin"
                size={18}
                color={colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.slotControlTitle}>Your rotation slots</Text>
              <Text style={styles.slotControlSub}>
                You receive a payout once per slot you hold.
              </Text>
            </View>
          </View>

          {/* Slot picker */}
          <View style={styles.slotControlRow}>
            {([1, 2, 3] as const).map((n) => {
              const wouldFit = totalSlots - mySlots + n <= group.maxMembers;
              const isSelected = n === mySlots;
              const isLoading = updateMySlots.isPending && isSelected;
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
                  {isLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.textOnPrimary}
                    />
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.slotOptionNum,
                          isSelected && styles.slotOptionTextSelected,
                          disabled &&
                            !isSelected &&
                            styles.slotOptionTextDisabled,
                        ]}
                      >
                        {n}
                      </Text>
                      <Text
                        style={[
                          styles.slotOptionLabel,
                          isSelected && styles.slotOptionTextSelected,
                          disabled &&
                            !isSelected &&
                            styles.slotOptionTextDisabled,
                        ]}
                      >
                        {n === 1 ? "slot" : "slots"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Progress bar */}
          <View style={styles.slotControlFooter}>
            <View style={styles.slotControlProgress}>
              <View
                style={[
                  styles.slotControlProgressFill,
                  {
                    width: `${Math.round((totalSlots / group.maxMembers) * 100)}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.slotControlHint}>
              {totalSlots}/{group.maxMembers} spots taken
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
                setSelectedDate(
                  group.startDate ? new Date(group.startDate) : new Date(),
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
              <ActivityIndicator color={colors.textOnPrimary} size="small" />
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabs}
        accessibilityRole="tablist"
      >
        {(
          ["cycles", "members", "activity", "payouts", "penalties"] as Tab[]
        ).map((t) => {
          const label = t.charAt(0).toUpperCase() + t.slice(1);
          return (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: tab === t }}
              style={[styles.tabItem, tab === t && styles.tabItemActive]}
              onPress={() => setTab(t)}
            >
              <Text
                variant="bodyStrong"
                tone={tab === t ? "brand" : "secondary"}
                style={styles.tabText}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
          <CyclesTab
            cycles={group.cycles}
            myMemberId={myMember?.id}
            onSelectCycle={setSelectedCycle}
          />
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
        {tab === "activity" && (
          <ActivityTab history={history} isLoading={historyLoading} />
        )}
        {tab === "payouts" && <PayoutsTab payouts={history?.payouts ?? []} />}
        {tab === "penalties" && (
          <PenaltiesTab penalties={history?.penalties ?? []} />
        )}
      </ScrollView>

      <CycleActivitySheet
        cycle={selectedCycle}
        members={group.members}
        onClose={() => setSelectedCycle(null)}
      />

      {/* Date picker — Android shows system dialog, iOS shows bottom sheet */}
      {datePickerOpen && Platform.OS === "android" && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="calendar"
          minimumDate={new Date()}
          onChange={(event, date) => {
            setDatePickerOpen(false);
            if (event.type === "set" && date) {
              setSelectedDate(date);
              handleSaveDate(date);
            }
          }}
        />
      )}

      <Modal
        visible={datePickerOpen && Platform.OS === "ios"}
        transparent
        animationType="slide"
        onRequestClose={() => setDatePickerOpen(false)}
      >
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setDatePickerOpen(false)}
        />
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={styles.datePickerSheet}>
            <Text style={styles.datePickerTitle}>Set start date</Text>
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="inline"
              minimumDate={new Date()}
              onChange={(_event, date) => {
                if (date) setSelectedDate(date);
              }}
              style={{ alignSelf: "stretch" }}
            />
            <TouchableOpacity
              style={[
                styles.datePickerSave,
                updateGroup.isPending && { opacity: 0.6 },
              ]}
              onPress={() => handleSaveDate()}
              disabled={updateGroup.isPending}
            >
              {updateGroup.isPending ? (
                <ActivityIndicator color={colors.textOnPrimary} size="small" />
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
                    <ActivityIndicator
                      color={colors.textOnPrimary}
                      size="small"
                    />
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
  onSelectCycle,
}: {
  cycles: Cycle[];
  myMemberId?: string;
  onSelectCycle: (cycle: Cycle) => void;
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
          <Pressable
            key={cycle.id}
            accessibilityRole="button"
            accessibilityLabel={`View activity for cycle ${cycle.cycleNumber}`}
            onPress={() => onSelectCycle(cycle)}
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
            <View style={styles.cycleActivityLink}>
              <Text variant="caption" tone="brand">
                View contribution activity
              </Text>
              <Feather name="chevron-right" size={18} color={colors.primary} />
            </View>
          </Pressable>
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

function CycleActivitySheet({
  cycle,
  members,
  onClose,
}: {
  cycle: Cycle | null;
  members: GroupMember[];
  onClose: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!cycle) return null;

  const paidCount =
    cycle.contributions?.filter(
      (contribution) => contribution.status === "PAID",
    ).length ?? 0;
  const contributions = cycle.contributions ?? [];

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.cycleSheetRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close cycle activity"
          style={styles.cycleSheetBackdrop}
          onPress={onClose}
        />
        <View style={styles.cycleSheet}>
          <View style={styles.cycleSheetHandle} />
          <View style={styles.cycleSheetHeader}>
            <View style={styles.cycleSheetTitleGroup}>
              <Text variant="title2">Cycle {cycle.cycleNumber}</Text>
              <Text variant="caption" tone="secondary">
                Due {formatDate(cycle.dueDate)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close cycle activity"
              hitSlop={8}
              style={styles.cycleSheetClose}
              onPress={onClose}
            >
              <Feather name="x" size={20} color={colors.icon} />
            </Pressable>
          </View>

          <View style={styles.cycleSheetSummary}>
            <View style={styles.cycleSheetSummaryItem}>
              <Text variant="caption" tone="secondary">
                Contributions received
              </Text>
              <Text variant="title2" tabularNumbers>
                {paidCount} of {contributions.length}
              </Text>
            </View>
            <StatusBadge
              label={cycle.status.replace("_", " ")}
              variant={
                cycle.status === "COMPLETED"
                  ? "completed"
                  : cycle.status === "ACTIVE" || cycle.status === "IN_PROGRESS"
                    ? "success"
                    : "neutral"
              }
            />
          </View>

          {cycle.recipientMember && (
            <View style={styles.cycleRecipientBanner}>
              <Feather
                name="corner-down-right"
                size={18}
                color={colors.primary}
              />
              <Text
                variant="body"
                tone="secondary"
                style={styles.cycleRecipientText}
              >
                Payout recipient
              </Text>
              <Text variant="bodyStrong" style={styles.cycleRecipientName}>
                {cycle.recipientMember.user.fullName}
              </Text>
            </View>
          )}

          <Text variant="headline" style={styles.cycleActivityHeading}>
            Member activity
          </Text>

          <ScrollView
            style={styles.cycleActivityList}
            contentContainerStyle={styles.cycleActivityListContent}
            showsVerticalScrollIndicator={false}
          >
            {contributions.length === 0 ? (
              <View style={styles.cycleActivityEmpty}>
                <Text variant="body" tone="secondary">
                  No contribution activity is available for this cycle yet.
                </Text>
              </View>
            ) : (
              contributions.map((contribution) => {
                const member = members.find(
                  (candidate) => candidate.id === contribution.memberId,
                );
                const paid = contribution.status === "PAID";
                const statusTone: TextTone = paid
                  ? "success"
                  : contribution.status === "OVERDUE"
                    ? "danger"
                    : "secondary";
                return (
                  <View key={contribution.id} style={styles.cycleActivityRow}>
                    <View
                      style={[
                        styles.cycleActivityIcon,
                        paid
                          ? styles.cycleActivityIconPaid
                          : styles.cycleActivityIconPending,
                      ]}
                    >
                      <Feather
                        name={paid ? "check" : "clock"}
                        size={17}
                        color={paid ? colors.success : colors.iconMuted}
                      />
                    </View>
                    <View style={styles.cycleActivityMember}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {member?.user.fullName ?? "Group member"}
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {paid && contribution.paidAt
                          ? `Paid ${formatActivityTimestamp(contribution.paidAt)}`
                          : `Due ${formatDate(cycle.dueDate)}`}
                      </Text>
                    </View>
                    <View style={styles.cycleActivityAmount}>
                      <Text variant="bodyStrong" tabularNumbers>
                        {formatCurrency(contribution.amount)}
                      </Text>
                      <Text variant="caption" tone={statusTone}>
                        {paid
                          ? "Paid"
                          : contribution.status === "OVERDUE"
                            ? "Overdue"
                            : contribution.status.toLowerCase()}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function formatActivityTimestamp(date: string): string {
  return new Date(date).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
                    color={colors.primary}
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
                  <Text
                    style={[
                      styles.slotsBadgeText,
                      { fontSize: typography.caption.fontSize },
                    ]}
                  >
                    {slots} slots
                  </Text>
                </View>
              )}
              {tc && (
                <View
                  style={[
                    styles.tierBadge,
                    {
                      backgroundColor: colors.primarySubtle,
                      borderColor: colors.borderInput,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    },
                  ]}
                >
                  <Feather name={tc.icon} size={14} color={colors.primary} />
                  <Text
                    style={[styles.tierBadgeText, { color: colors.primary }]}
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
                <Feather
                  name="phone"
                  size={16}
                  color={colors.iconMuted}
                  style={styles.profileRowIcon}
                />
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
              <Feather
                name="mail"
                size={16}
                color={colors.iconMuted}
                style={styles.profileRowIcon}
              />
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
              <Feather
                name="calendar"
                size={16}
                color={colors.iconMuted}
                style={styles.profileRowIcon}
              />
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
                  <Feather
                    name="credit-card"
                    size={16}
                    color={colors.iconMuted}
                    style={styles.profileRowIcon}
                  />
                  <Text style={styles.profileRowText}>
                    {paid.length} contribution{paid.length !== 1 ? "s" : ""}{" "}
                    paid
                  </Text>
                </View>
                {onTimeRate !== null && (
                  <View style={styles.profileRow}>
                    <Feather
                      name="clock"
                      size={16}
                      color={colors.iconMuted}
                      style={styles.profileRowIcon}
                    />
                    <Text
                      style={[
                        styles.profileRowText,
                        {
                          color:
                            onTimeRate === 100
                              ? colors.success
                              : onTimeRate >= 75
                                ? colors.warning
                                : colors.danger,
                        },
                      ]}
                    >
                      {onTimeRate}% on time
                    </Text>
                  </View>
                )}
                {penalties.length > 0 && (
                  <View style={styles.profileRow}>
                    <Feather
                      name="alert-triangle"
                      size={16}
                      color={colors.danger}
                      style={styles.profileRowIcon}
                    />
                    <Text
                      style={[styles.profileRowText, { color: colors.danger }]}
                    >
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

function ActivityTab({
  history,
  isLoading,
}: {
  history: GroupHistory | undefined;
  isLoading: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isLoading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const contribs = history?.contributions ?? [];
  const payouts = history?.payouts ?? [];
  const penalties = history?.penalties ?? [];

  type ActivityItem = {
    id: string;
    label: string;
    amount: string;
    date: string;
    kind: "contribution" | "payout" | "penalty";
  };
  const items: ActivityItem[] = [
    ...contribs.flatMap((c) =>
      c.status === "PAID" && c.paidAt
        ? [
            {
              id: `contribution-${c.id}`,
              label: `${c.member.user.fullName} contributed`,
              amount: c.amount,
              date: c.paidAt,
              kind: "contribution" as const,
            },
          ]
        : [],
    ),
    ...payouts.map((p) => ({
      id: `payout-${p.id}`,
      label:
        p.status === "COMPLETED"
          ? `${p.recipient.fullName} received a payout`
          : p.status === "FAILED"
            ? `Payout to ${p.recipient.fullName} failed`
            : p.status === "INITIATED"
              ? `Payout initiated for ${p.recipient.fullName}`
              : p.status === "PENDING"
                ? `Payout pending for ${p.recipient.fullName}`
                : `Payout status: ${p.status.toLowerCase()}`,
      amount: p.amount,
      date:
        p.status === "COMPLETED"
          ? (p.completedAt ?? p.initiatedAt ?? p.createdAt)
          : (p.initiatedAt ?? p.createdAt),
      kind: "payout" as const,
    })),
    ...penalties
      .filter((p) => p.status === "APPLIED")
      .map((p) => ({
        id: `penalty-${p.id}`,
        label: `Penalty applied to ${p.member.user.fullName}`,
        amount: p.penaltyAmount,
        date: p.appliedAt ?? p.createdAt,
        kind: "penalty" as const,
      })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (items.length === 0) {
    return <EmptyState text="No activity yet." />;
  }
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item.id} style={styles.activityRow}>
          <View
            style={[
              styles.activityIcon,
              item.kind === "penalty"
                ? styles.activityIconDebit
                : styles.activityIconCredit,
            ]}
          >
            <Feather
              name={
                item.kind === "penalty" ? "alert-circle" : "arrow-down-left"
              }
              size={18}
              color={item.kind === "penalty" ? colors.danger : colors.success}
            />
          </View>
          <View style={styles.activityInfo}>
            <Text variant="bodyStrong" style={styles.activityDesc}>
              {item.label}
            </Text>
            <Text
              variant="caption"
              tone="secondary"
              style={styles.activityDate}
            >
              {formatActivityTimestamp(item.date)}
            </Text>
          </View>
          <Text
            variant="bodyStrong"
            tone={item.kind === "penalty" ? "danger" : "success"}
            tabularNumbers
            style={styles.activityAmount}
          >
            {formatCurrency(item.amount)}
          </Text>
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
              <Text
                style={[styles.activityAmount, styles.credit]}
                tabularNumbers
              >
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
              <Text
                style={[styles.activityAmount, styles.debit]}
                tabularNumbers
              >
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
      paddingHorizontal: spacing[5],
      paddingTop: 56,
      paddingBottom: spacing[5],
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    back: { minHeight: 44, justifyContent: "center", marginBottom: spacing[2] },
    backText: { color: colors.primary },
    headerRow: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
    headerInfo: { flex: 1, gap: spacing[1] },
    groupName: { flexShrink: 1 },
    groupMeta: { marginTop: spacing[1] },
    groupSummary: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[5],
      marginTop: spacing[5],
      padding: spacing[4],
      borderRadius: radii.medium,
      backgroundColor: colors.surfaceRaised,
    },
    groupSummaryItem: { flex: 1, gap: spacing[1] },
    groupSummaryDivider: {
      width: 1,
      height: spacing[8],
      backgroundColor: colors.border,
    },
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
      fontSize: typography.body.fontSize,
      fontWeight: "700",
      color: colors.primaryText,
    },
    inviteBannerSub: {
      fontSize: typography.caption.fontSize,
      color: colors.primaryTextMid,
      marginTop: 2,
    },
    inviteBannerBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 10,
    },
    inviteBannerBtnText: { color: colors.textOnPrimary },
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
    inviteBtnText: {
      fontSize: typography.caption.fontSize,
      fontWeight: "700",
      color: colors.primary,
    },
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
    payCtaTitle: {
      fontSize: typography.caption.fontSize,
      fontWeight: "700",
      color: colors.primaryText,
    },
    payCtaDate: {
      fontSize: typography.caption.fontSize,
      color: colors.primaryTextMid,
      marginTop: 1,
    },
    payBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    payBtnDisabled: { opacity: 0.6 },
    payBtnText: { color: colors.textOnPrimary },
    payCtaFee: {
      fontSize: typography.overline.fontSize,
      color: colors.primaryTextMid,
      marginTop: 2,
    },
    walletBtn: {
      backgroundColor: colors.primaryPressed,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderInput,
    },
    walletBtnDisabled: { opacity: 0.45 },
    walletBtnText: { color: colors.textOnPrimary },
    walletBtnTextDisabled: { opacity: 0.6 },
    feeModalBackdrop: { flex: 1, backgroundColor: colors.overlay },
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
      fontSize: typography.headline.fontSize,
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
    feeRowLabel: {
      fontSize: typography.body.fontSize,
      color: colors.textMuted,
    },
    feeRowValue: {
      fontSize: typography.body.fontSize,
      fontWeight: "500",
      color: colors.text,
    },
    feeRowTotal: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
      marginTop: 2,
    },
    feeRowTotalLabel: {
      fontSize: typography.body.fontSize,
      fontWeight: "700",
      color: colors.text,
    },
    feeRowTotalValue: {
      fontSize: typography.body.fontSize,
      fontWeight: "700",
      color: colors.primary,
    },
    methodLabel: {
      fontSize: typography.caption.fontSize,
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
    methodName: {
      fontSize: typography.body.fontSize,
      fontWeight: "600",
      color: colors.text,
    },
    methodAmount: {
      fontSize: typography.body.fontSize,
      fontWeight: "700",
      color: colors.text,
    },
    methodSub: {
      fontSize: typography.caption.fontSize,
      color: colors.textMuted,
    },
    feeModalActions: { flexDirection: "row", gap: 12, marginTop: 4 },
    feeCancelBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
    },
    feeCancelBtnText: {
      fontSize: typography.body.fontSize,
      fontWeight: "600",
      color: colors.text,
    },
    feeConfirmBtn: {
      flex: 2,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
    },
    feeConfirmBtnText: { color: colors.textOnPrimary },
    paystackBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[1],
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
      fontSize: typography.overline.fontSize,
      color: colors.primaryTextMid,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    vaAccount: {
      fontSize: typography.body.fontSize,
      fontWeight: "700",
      color: colors.primaryText,
    },
    vaSub: {
      fontSize: typography.caption.fontSize,
      color: colors.primaryTextMid,
    },

    tabsScroll: {
      flexGrow: 0,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabs: {
      flexDirection: "row",
      paddingHorizontal: spacing[3],
    },
    tabItem: {
      minHeight: spacing[10] + spacing[1],
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing[4],
      borderBottomWidth: 2,
      borderBottomColor: colors.surface,
    },
    tabItemActive: { borderBottomColor: colors.primary },
    tabText: { textAlign: "center" },

    scrollView: { flex: 1 },
    scrollContent: { padding: spacing[5], gap: spacing[4] },
    list: { gap: spacing[3] },

    cycleCard: {
      backgroundColor: colors.card,
      borderRadius: radii.large,
      padding: spacing[5],
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing[4],
    },
    cycleCardActive: {
      borderColor: colors.borderInput,
      backgroundColor: colors.primaryBg,
    },
    cycleHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[4],
    },
    cycleNumber: {
      width: spacing[10] + spacing[2],
      height: spacing[10] + spacing[2],
      borderRadius: radii.medium,
      backgroundColor: colors.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    cycleNumberActive: { backgroundColor: colors.primary },
    cycleNumberText: { color: colors.textSecondary },
    cycleNumberTextActive: { color: colors.textOnPrimary },
    cycleMeta: { flex: 1, gap: spacing[1] },
    cycleTitle: {},
    cycleDue: {},
    cycleRecipient: {},
    myStatus: {},
    miniPayBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
      borderRadius: radii.small,
    },
    miniPayBtnText: { color: colors.textOnPrimary },

    contribProgress: { gap: spacing[2] },
    contribProgressText: {},
    progressBar: {
      height: spacing[1],
      backgroundColor: colors.border,
      borderRadius: 99,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: 99,
    },
    cycleActivityLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: spacing[10],
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing[2],
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
      fontSize: typography.body.fontSize,
      fontWeight: "700",
      color: colors.primary,
    },
    memberInfo: { flex: 1, gap: 2 },
    memberName: {
      fontSize: typography.body.fontSize,
      fontWeight: "600",
      color: colors.text,
    },
    memberEmail: {
      fontSize: typography.caption.fontSize,
      color: colors.textMuted,
    },
    memberPhone: {
      fontSize: typography.caption.fontSize,
      color: colors.textMuted,
    },
    tierBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99 },
    tierBadgeText: {
      fontSize: typography.overline.fontSize,
      fontWeight: "700",
    },
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
      fontSize: typography.overline.fontSize,
      fontWeight: "700",
      color: colors.primary,
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
      fontSize: typography.overline.fontSize,
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
    adminBadgeText: {
      fontSize: typography.overline.fontSize,
      fontWeight: "700",
      color: colors.primary,
    },

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
      fontSize: typography.title1.fontSize,
      fontWeight: "700",
      color: colors.primary,
    },
    profileNameLg: {
      fontSize: typography.title2.fontSize,
      fontWeight: "700",
      color: colors.text,
    },
    profileSection: { gap: 8 },
    profileSectionTitle: {
      fontSize: typography.overline.fontSize,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    profileRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    profileRowIcon: { width: 22, textAlign: "center" },
    profileRowText: {
      fontSize: typography.body.fontSize,
      color: colors.text,
      flex: 1,
    },
    cyclesSummary: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    cyclesSummaryText: {
      fontSize: typography.caption.fontSize,
      fontWeight: "600",
      color: colors.text,
    },
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

    cycleSheetRoot: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: colors.overlay,
    },
    cycleSheetBackdrop: { ...StyleSheet.absoluteFill },
    cycleSheet: {
      maxHeight: "88%",
      minHeight: "62%",
      paddingTop: spacing[3],
      paddingHorizontal: spacing[5],
      paddingBottom: spacing[6],
      gap: spacing[4],
      backgroundColor: colors.background,
      borderTopLeftRadius: radii.large,
      borderTopRightRadius: radii.large,
    },
    cycleSheetHandle: {
      width: spacing[10],
      height: spacing[1],
      borderRadius: radii.small,
      alignSelf: "center",
      backgroundColor: colors.borderInput,
    },
    cycleSheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing[4],
    },
    cycleSheetTitleGroup: { flex: 1, gap: spacing[1] },
    cycleSheetClose: {
      width: spacing[10] + spacing[1],
      height: spacing[10] + spacing[1],
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.medium,
      backgroundColor: colors.surfaceRaised,
    },
    cycleSheetSummary: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing[4],
      padding: spacing[4],
      borderRadius: radii.medium,
      backgroundColor: colors.surfaceRaised,
    },
    cycleSheetSummaryItem: { gap: spacing[1] },
    cycleRecipientBanner: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing[2],
      padding: spacing[3],
      borderRadius: radii.medium,
      backgroundColor: colors.primarySubtle,
    },
    cycleRecipientText: { flexShrink: 0 },
    cycleRecipientName: { flexShrink: 1 },
    cycleActivityHeading: { marginTop: spacing[1] },
    cycleActivityList: { flex: 1 },
    cycleActivityListContent: { paddingBottom: spacing[3] },
    cycleActivityEmpty: {
      paddingVertical: spacing[6],
      alignItems: "center",
    },
    cycleActivityRow: {
      minHeight: spacing[10] + spacing[5],
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: spacing[3],
    },
    cycleActivityIcon: {
      width: spacing[10],
      height: spacing[10],
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.medium,
    },
    cycleActivityIconPaid: { backgroundColor: colors.successSubtle },
    cycleActivityIconPending: { backgroundColor: colors.surfaceRaised },
    cycleActivityMember: { flex: 1, gap: spacing[1] },
    cycleActivityAmount: { alignItems: "flex-end", gap: spacing[1] },

    activityRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: colors.card,
      borderRadius: radii.large,
      padding: spacing[4],
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing[3],
    },
    activityIcon: {
      width: spacing[10],
      height: spacing[10],
      borderRadius: radii.medium,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    activityIconCredit: { backgroundColor: colors.successBg },
    activityIconDebit: { backgroundColor: colors.dangerBg },
    activityInfo: { flex: 1, gap: spacing[1] },
    activityDesc: { flexShrink: 1 },
    activityDate: { flexShrink: 1 },
    activityAmount: { flexShrink: 0 },
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
    payoutRecipient: {
      fontSize: typography.body.fontSize,
      fontWeight: "600",
      color: colors.text,
    },
    payoutMeta: {
      fontSize: typography.caption.fontSize,
      color: colors.textMuted,
    },

    slotControlCard: {
      marginHorizontal: 16,
      marginVertical: 8,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    slotControlHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    slotControlIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primaryBg,
      alignItems: "center",
      justifyContent: "center",
    },
    slotControlTitle: {
      fontSize: typography.body.fontSize,
      fontWeight: "700",
      color: colors.text,
    },
    slotControlSub: {
      fontSize: typography.caption.fontSize,
      color: colors.textMuted,
      marginTop: 1,
    },
    slotControlRow: { flexDirection: "row", gap: 10 },
    slotOption: {
      flex: 1,
      height: 64,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    slotOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    slotOptionDisabled: { opacity: 0.35 },
    slotOptionNum: {
      fontSize: typography.title2.fontSize,
      fontWeight: "800",
      color: colors.text,
    },
    slotOptionLabel: {
      fontSize: typography.overline.fontSize,
      fontWeight: "500",
      color: colors.textMuted,
    },
    slotOptionText: {
      fontSize: typography.body.fontSize,
      fontWeight: "700",
      color: colors.text,
    },
    slotOptionTextSelected: { color: colors.textOnPrimary },
    slotOptionTextDisabled: { color: colors.textMuted },
    slotControlFooter: { flexDirection: "row", alignItems: "center", gap: 10 },
    slotControlProgress: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    slotControlProgressFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    slotControlHint: {
      fontSize: typography.overline.fontSize,
      color: colors.textMuted,
    },

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
      fontSize: typography.caption.fontSize,
      fontWeight: "700",
      color: colors.primaryText,
    },
    slotOfferSub: {
      fontSize: typography.caption.fontSize,
      color: colors.primaryTextMid,
    },
    slotOfferBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      alignItems: "center",
    },
    slotOfferBtnText: { color: colors.textOnPrimary },
    slotOfferDecline: {
      fontSize: typography.caption.fontSize,
      color: colors.textMuted,
      textAlign: "center",
    },

    emptyState: { paddingVertical: 40, alignItems: "center" },
    emptyStateText: {
      fontSize: typography.body.fontSize,
      color: colors.textMuted,
    },

    modalRoot: { flex: 1, backgroundColor: colors.overlay },
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
    sheetTitle: {
      fontSize: typography.headline.fontSize,
      fontWeight: "700",
      color: colors.text,
    },
    sheetSub: {
      fontSize: typography.body.fontSize,
      color: colors.textMuted,
      marginTop: -8,
    },
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
    modeBtnText: {
      fontSize: typography.body.fontSize,
      fontWeight: "600",
      color: colors.textMuted,
    },
    modeBtnTextActive: { color: colors.textOnPrimary },
    inviteInput: {
      height: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: typography.body.fontSize,
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
    sheetBtnText: { color: colors.textOnPrimary },
    cancelBtn: { alignItems: "center", paddingVertical: 4 },
    cancelBtnText: {
      fontSize: typography.body.fontSize,
      color: colors.textMuted,
    },
    successBox: { gap: 12 },
    successMsg: {
      fontSize: typography.body.fontSize,
      fontWeight: "700",
      color: colors.successText,
    },
    successHint: {
      fontSize: typography.caption.fontSize,
      color: colors.textMuted,
    },
    shareBtn: {
      height: 44,
      backgroundColor: colors.primaryBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    shareBtnText: {
      fontSize: typography.body.fontSize,
      fontWeight: "700",
      color: colors.primary,
    },
    inviteAnother: { alignItems: "center", paddingVertical: 4 },
    inviteAnotherText: {
      fontSize: typography.caption.fontSize,
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
    startCardLabel: {
      fontSize: typography.caption.fontSize,
      color: colors.textMuted,
      marginBottom: 2,
    },
    startCardValue: {
      fontSize: typography.body.fontSize,
      fontWeight: "600",
      color: colors.text,
    },
    startCardEditBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primaryBg,
    },
    startCardEditBtnText: {
      fontSize: typography.caption.fontSize,
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
    startGroupBtnText: { color: colors.textOnPrimary },
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
      fontSize: typography.body.fontSize,
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
    datePickerTitle: {
      fontSize: typography.headline.fontSize,
      fontWeight: "700",
      color: colors.text,
    },
    datePickerInput: {
      height: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: typography.body.fontSize,
      color: colors.text,
      backgroundColor: colors.inputBg,
      letterSpacing: 1,
    },
    datePickerHint: {
      fontSize: typography.caption.fontSize,
      color: colors.textMuted,
      marginTop: -8,
    },
    datePickerSave: {
      height: 46,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    datePickerSaveText: { color: colors.textOnPrimary },
    datePickerCancel: { alignItems: "center", paddingVertical: 8 },
    datePickerCancelText: {
      fontSize: typography.body.fontSize,
      color: colors.textMuted,
    },
  });
}
