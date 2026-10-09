import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import {
  useCurrentUser,
  useMyContributions,
  useMyGroups,
} from "@/hooks/use-dashboard";
import { useNextPayout } from "@/hooks/use-payments";
import { useWallet } from "@/hooks/use-wallet";
import { useColors } from "@/lib/colors";
import { formatCurrency, formatRelativeDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { radii, spacing, typography } from "@/theme";

export default function HomeScreen() {
  const {
    data: me,
    isLoading: meLoading,
    refetch: refetchMe,
  } = useCurrentUser();
  const {
    data: wallet,
    isLoading: walletLoading,
    isError: walletFailed,
    refetch: refetchWallet,
  } = useWallet();
  const {
    data: groups = [],
    isLoading: groupsLoading,
    isError: groupsFailed,
    refetch: refetchGroups,
  } = useMyGroups();
  const {
    data: contributions = [],
    isLoading: contribLoading,
    isError: contributionsFailed,
    refetch: refetchContribs,
  } = useMyContributions();
  const { data: nextPayout, refetch: refetchPayout } = useNextPayout();
  const [kycPromptOpen, setKycPromptOpen] = useState(false);

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!me) return;
    const status = me.kycProfile?.kycStatus;
    if (
      status === "VERIFIED" ||
      status === "PENDING" ||
      status === "UNDER_REVIEW"
    )
      return;
    const key = `poolr_kyc_prompt_dismissed_${me.id}`;
    void SecureStore.getItemAsync(key).then((val) => {
      if (!val) setKycPromptOpen(true);
    });
  }, [me?.id]);

  async function dismissKycPrompt() {
    setKycPromptOpen(false);
    if (me?.id) {
      await SecureStore.setItemAsync(
        `poolr_kyc_prompt_dismissed_${me.id}`,
        "1",
      );
    }
  }

  const isRefreshing =
    meLoading || walletLoading || groupsLoading || contribLoading;

  function onRefresh() {
    void Promise.all([
      refetchMe(),
      refetchWallet(),
      refetchGroups(),
      refetchContribs(),
      refetchPayout(),
    ]);
  }

  const pendingContribs = contributions
    .filter((c) => c.status === "PENDING" || c.status === "OVERDUE")
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const activeGroups = groups.filter((g) => g.status === "ACTIVE");
  const pendingInvites = groups.filter((g) =>
    g.members.some(
      (mb) => mb.userId === me?.id && mb.memberStatus === "INVITED",
    ),
  );
  const slotOfferGroups = groups.filter((g) => {
    const hasActive = g.members.some(
      (mb) => mb.userId === me?.id && mb.memberStatus === "ACTIVE",
    );
    const hasInvited = g.members.some(
      (mb) => mb.userId === me?.id && mb.memberStatus === "INVITED",
    );
    return hasActive && hasInvited;
  });
  const balance = parseFloat(wallet?.balance ?? "0");

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text variant="title2" style={styles.greeting}>
              Hello, {me?.fullName?.split(" ")[0] ?? "—"}
            </Text>
            <Text style={styles.greetingSub}>Here's your savings overview</Text>
          </View>
          <ThemeToggle />
        </View>

        {/* KYC banner */}
        {me && me.kycProfile?.kycStatus !== "VERIFIED" && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open identity verification"
            style={[
              styles.kycBanner,
              me.kycProfile?.kycStatus === "PENDING" ||
              me.kycProfile?.kycStatus === "UNDER_REVIEW"
                ? styles.kycBannerPending
                : styles.kycBannerUnverified,
            ]}
            onPress={() => router.push("/kyc")}
            activeOpacity={0.85}
          >
            <View style={styles.kycBannerLeft}>
              <View style={styles.kycBannerIcon}>
                <Feather
                  name={
                    me.kycProfile?.kycStatus === "PENDING" ||
                    me.kycProfile?.kycStatus === "UNDER_REVIEW"
                      ? "clock"
                      : "shield"
                  }
                  size={18}
                  color={
                    me.kycProfile?.kycStatus === "PENDING" ||
                    me.kycProfile?.kycStatus === "UNDER_REVIEW"
                      ? colors.infoText
                      : colors.warning
                  }
                />
              </View>
              <View>
                <Text style={styles.kycBannerTitle}>
                  {me.kycProfile?.kycStatus === "PENDING" ||
                  me.kycProfile?.kycStatus === "UNDER_REVIEW"
                    ? "Verification in review"
                    : "Verify your identity"}
                </Text>
                <Text style={styles.kycBannerSub}>
                  {me.kycProfile?.kycStatus === "PENDING" ||
                  me.kycProfile?.kycStatus === "UNDER_REVIEW"
                    ? "We'll notify you when approved"
                    : "Required to create or join groups"}
                </Text>
              </View>
            </View>
            {me.kycProfile?.kycStatus !== "PENDING" &&
              me.kycProfile?.kycStatus !== "UNDER_REVIEW" && (
                <Feather
                  name="chevron-right"
                  size={18}
                  color={colors.textMuted}
                />
              )}
          </TouchableOpacity>
        )}

        {/* Wallet balance card */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open wallet balance"
          style={styles.balanceCard}
          onPress={() => router.push("/(tabs)/wallet")}
          activeOpacity={0.85}
        >
          <Text style={styles.balanceLabel}>Wallet balance</Text>
          {walletLoading ? (
            <Skeleton style={styles.balanceSkeleton} />
          ) : walletFailed && !wallet ? (
            <Text variant="caption" tone="onPrimary">
              Balance unavailable. Pull down to try again.
            </Text>
          ) : (
            <Text
              variant="display"
              tabularNumbers
              tone="onPrimary"
              style={styles.balanceAmount}
            >
              {formatCurrency(balance)}
            </Text>
          )}
          <Text style={styles.balanceSub}>Tap to manage wallet</Text>
        </TouchableOpacity>

        {/* Next payout */}
        {nextPayout && (
          <View style={styles.section}>
            <View style={styles.payoutCard}>
              <Text style={styles.payoutLabel}>Your next payout</Text>
              <Text variant="title1" tabularNumbers style={styles.payoutAmount}>
                {formatCurrency(nextPayout.amountNgn)}
              </Text>
              <Text style={styles.payoutFrom}>
                {nextPayout.groupName} · Cycle {nextPayout.cycleNumber}
              </Text>
              {nextPayout.isActive ? (
                <Text style={styles.payoutDate}>Collection in progress</Text>
              ) : (
                <Text style={styles.payoutDate}>
                  Due {formatRelativeDate(nextPayout.dueDate)}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Pending invites{" "}
              <Text style={styles.inviteBadge}>{pendingInvites.length}</Text>
            </Text>
            {pendingInvites.map((g) => (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Review invite for ${g.name}`}
                key={g.id}
                style={styles.inviteCard}
                activeOpacity={0.75}
                onPress={() => router.push(`/groups/invite-review/${g.id}`)}
              >
                <View style={styles.inviteCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inviteName} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text tabularNumbers style={styles.inviteMeta}>
                      {g.frequency.toLowerCase()} ·{" "}
                      {formatCurrency(g.contributionAmount)} per member
                    </Text>
                  </View>
                  <StatusBadge label="Invited" variant="warning" />
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.inviteReview}>Review invite →</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Pending contributions */}
        {contributionsFailed && contributions.length === 0 && (
          <ErrorState
            title="Contributions unavailable"
            action={
              <Button
                accessibilityLabel="Retry loading contributions"
                variant="secondary"
                onPress={() => void refetchContribs()}
              >
                Try again
              </Button>
            }
          >
            Check your connection and try again.
          </ErrorState>
        )}
        {pendingContribs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming contributions</Text>
            {pendingContribs.map((c) => {
              const isDue = new Date(c.dueAt).getTime() <= Date.now();
              const isOverdue = c.status === "OVERDUE" && isDue;

              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Open contribution for ${c.cycle.group.name}`}
                  key={c.id}
                  style={[
                    styles.contribRow,
                    isOverdue && styles.contribOverdue,
                  ]}
                  onPress={() => router.push(`/groups/${c.cycle.group.id}`)}
                  activeOpacity={0.75}
                >
                  <View style={styles.contribLeft}>
                    <Text style={styles.contribName}>{c.cycle.group.name}</Text>
                    <Text style={styles.contribMeta}>
                      Cycle {c.cycle.cycleNumber} · Due{" "}
                      {formatRelativeDate(c.dueAt)}
                    </Text>
                  </View>
                  <View style={styles.contribRight}>
                    <Text
                      variant="bodyStrong"
                      tabularNumbers
                      style={styles.contribAmount}
                    >
                      {formatCurrency(c.amount)}
                    </Text>
                    {isOverdue ? (
                      <StatusBadge label="Overdue" variant="danger" />
                    ) : isDue ? (
                      <StatusBadge label="Due" variant="warning" />
                    ) : (
                      <StatusBadge label="Upcoming" variant="neutral" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Slot offers from admin */}
        {slotOfferGroups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Slot offers</Text>
            {slotOfferGroups.map((g) => (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Review slot offer for ${g.name}`}
                key={g.id}
                style={styles.slotOfferCard}
                activeOpacity={0.75}
                onPress={() => router.push(`/groups/${g.id}`)}
              >
                <Feather
                  name="gift"
                  size={22}
                  color={colors.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.slotOfferCardTitle}>{g.name}</Text>
                  <Text style={styles.slotOfferCardMeta}>
                    Admin offered you an extra rotation slot — tap to accept or
                    decline
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={16}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty state — no groups and no pending invites */}
        {groupsFailed && groups.length === 0 ? (
          <ErrorState
            title="Groups unavailable"
            action={
              <Button
                accessibilityLabel="Retry loading groups"
                variant="secondary"
                onPress={() => void refetchGroups()}
              >
                Try again
              </Button>
            }
          >
            Check your connection and try loading your savings circles again.
          </ErrorState>
        ) : null}
        {groups.length === 0 &&
          pendingInvites.length === 0 &&
          !groupsFailed &&
          !groupsLoading && (
            <View style={styles.getStarted}>
              <View style={styles.getStartedIcon}>
                <Feather name="users" size={32} color={colors.primary} />
              </View>
              <Text style={styles.getStartedTitle}>Start saving together</Text>
              <Text style={styles.getStartedBody}>
                Create your own savings circle or join one from a friend.
                Everyone contributes, everyone benefits.
              </Text>
              <Button
                accessibilityLabel="Create a savings group"
                style={styles.getStartedPrimary}
                onPress={() => router.push("/groups/new")}
              >
                Create a group
              </Button>
              <Button
                accessibilityLabel="Join a savings group"
                variant="secondary"
                style={styles.getStartedSecondary}
                onPress={() => router.push("/(tabs)/groups")}
              >
                Join a group
              </Button>
            </View>
          )}

        {/* Active groups */}
        {groups.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active groups</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="See all savings groups"
                onPress={() => router.push("/(tabs)/groups")}
              >
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {activeGroups.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  No active groups yet — your pending groups will appear here
                  once they start.
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="View all savings groups"
                  onPress={() => router.push("/(tabs)/groups")}
                >
                  <Text style={styles.emptyLink}>View all groups</Text>
                </TouchableOpacity>
              </View>
            ) : (
              activeGroups.slice(0, 3).map((g) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Open savings group ${g.name}`}
                  key={g.id}
                  style={styles.groupCard}
                  onPress={() => router.push(`/groups/${g.id}`)}
                  activeOpacity={0.75}
                >
                  <View style={styles.groupLeft}>
                    <View style={styles.groupAvatar}>
                      <Text style={styles.groupAvatarText}>
                        {g.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.groupName}>{g.name}</Text>
                      <Text tabularNumbers style={styles.groupMeta}>
                        {g.members.length} members · {g.frequency}
                      </Text>
                    </View>
                  </View>
                  <Text
                    variant="bodyStrong"
                    tabularNumbers
                    style={styles.groupAmount}
                  >
                    {formatCurrency(g.contributionAmount)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* KYC first-login prompt modal */}
      <Modal
        visible={kycPromptOpen}
        transparent
        animationType="fade"
        onRequestClose={() => void dismissKycPrompt()}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss identity verification prompt"
          style={styles.kycModalBackdrop}
          onPress={() => void dismissKycPrompt()}
        >
          <Pressable
            accessible={false}
            style={styles.kycModalCard}
            onPress={() => {}}
          >
            <View style={styles.kycModalIcon}>
              <Feather name="shield" size={32} color={colors.primary} />
            </View>
            <Text style={styles.kycModalTitle}>Verify your identity</Text>
            <Text style={styles.kycModalBody}>
              To create or join a savings group, you need to verify your
              identity. This protects you and every member of your circle.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Verify identity now"
              style={styles.kycModalPrimaryBtn}
              onPress={() => {
                void dismissKycPrompt();
                router.push("/kyc");
              }}
            >
              <Text style={styles.kycModalPrimaryBtnText}>Verify now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Dismiss verification reminder"
              style={styles.kycModalSecondaryBtn}
              onPress={() => void dismissKycPrompt()}
            >
              <Text style={styles.kycModalSecondaryBtnText}>Maybe later</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function createStyles(colors: import("@/lib/colors").Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing[4], paddingTop: spacing[10], gap: spacing[5] },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    greeting: { color: colors.text },
    greetingSub: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: spacing[1],
    },

    balanceCard: {
      backgroundColor: colors.primary,
      borderRadius: radii.large,
      padding: spacing[6],
      gap: spacing[1],
    },
    balanceSkeleton: {
      width: "70%",
      minHeight: spacing[8],
      backgroundColor: colors.primaryPressed,
    },
    balanceLabel: {
      ...typography.caption,
      color: colors.textOnPrimary,
    },
    balanceAmount: { color: colors.textOnPrimary },
    balanceSub: {
      ...typography.caption,
      color: colors.textOnPrimary,
      marginTop: spacing[1],
    },

    payoutCard: {
      backgroundColor: colors.primaryBg,
      borderRadius: radii.large,
      padding: spacing[4],
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    payoutLabel: {
      ...typography.overline,
      color: colors.primaryText,
      textTransform: "uppercase",
    },
    payoutAmount: {
      color: colors.primaryText,
      marginTop: spacing[1],
    },
    payoutFrom: {
      ...typography.caption,
      color: colors.primaryTextMid,
      marginTop: spacing[1],
    },
    payoutDate: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: spacing[1],
    },

    section: { gap: spacing[3] },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: { ...typography.bodyStrong, color: colors.text },
    seeAll: { ...typography.caption, color: colors.primary },

    contribRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.card,
      borderRadius: radii.medium,
      padding: spacing[4],
      borderWidth: 1,
      borderColor: colors.border,
    },
    contribOverdue: {
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerBg,
    },
    contribLeft: { gap: spacing[1] },
    contribName: { ...typography.bodyStrong, color: colors.text },
    contribMeta: { ...typography.caption, color: colors.textMuted },
    contribRight: { alignItems: "flex-end", gap: spacing[1] },
    contribAmount: { ...typography.bodyStrong, color: colors.text },

    groupCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.card,
      borderRadius: radii.medium,
      padding: spacing[4],
      borderWidth: 1,
      borderColor: colors.border,
    },
    groupLeft: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
    groupAvatar: {
      width: spacing[10],
      height: spacing[10],
      borderRadius: radii.medium,
      backgroundColor: colors.successBg,
      alignItems: "center",
      justifyContent: "center",
    },
    groupAvatarText: { ...typography.headline, color: colors.primary },
    groupName: { ...typography.bodyStrong, color: colors.text },
    groupMeta: { ...typography.caption, color: colors.textMuted },
    groupAmount: { ...typography.bodyStrong, color: colors.primary },

    slotOfferCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[3],
      backgroundColor: colors.card,
      borderRadius: radii.large,
      padding: spacing[4],
      borderWidth: 1.5,
      borderColor: colors.primaryBorder,
    },
    slotOfferCardTitle: { ...typography.bodyStrong, color: colors.text },
    slotOfferCardMeta: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: spacing[1],
    },

    inviteBadge: { ...typography.caption, color: colors.primary },
    inviteCard: {
      backgroundColor: colors.card,
      borderRadius: radii.large,
      padding: spacing[4],
      gap: spacing[3],
      borderWidth: 1.5,
      borderColor: colors.primaryBorder,
      borderStyle: "dashed",
    },
    inviteCardTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing[3],
    },
    inviteName: { ...typography.bodyStrong, color: colors.text },
    inviteMeta: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: spacing[1],
    },
    inviteReview: { ...typography.caption, color: colors.primary },

    empty: {
      backgroundColor: colors.card,
      borderRadius: radii.medium,
      padding: spacing[5],
      alignItems: "center",
      gap: spacing[2],
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
    },
    emptyText: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: "center",
    },
    emptyLink: { ...typography.caption, color: colors.primary },

    getStarted: {
      backgroundColor: colors.card,
      borderRadius: radii.large,
      padding: spacing[6],
      alignItems: "center",
      gap: spacing[3],
      borderWidth: 1,
      borderColor: colors.border,
    },
    getStartedIcon: {
      width: 72,
      height: 72,
      borderRadius: radii.large,
      backgroundColor: colors.primaryBg,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: spacing[1],
    },
    getStartedTitle: {
      ...typography.title2,
      color: colors.text,
      textAlign: "center",
    },
    getStartedBody: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: "center",
      maxWidth: 280,
    },
    getStartedPrimary: {
      width: "100%",
      marginTop: spacing[2],
      backgroundColor: colors.primary,
      borderRadius: radii.medium,
      paddingVertical: spacing[4],
      alignItems: "center",
    },
    getStartedSecondary: {
      width: "100%",
      backgroundColor: colors.primaryBg,
      borderRadius: radii.medium,
      paddingVertical: spacing[4],
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    kycBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: radii.medium,
      padding: spacing[4],
      borderWidth: 1,
    },
    kycBannerUnverified: {
      backgroundColor: colors.warningSubtle,
      borderColor: colors.warning,
    },
    kycBannerPending: {
      backgroundColor: colors.infoBg,
      borderColor: colors.borderInput,
    },
    kycBannerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[3],
      flex: 1,
    },
    kycBannerIcon: {
      width: spacing[10],
      height: spacing[10],
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    kycBannerTitle: { ...typography.bodyStrong, color: colors.text },
    kycBannerSub: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: spacing[1],
    },
    kycBannerArrow: { ...typography.title2, color: colors.textMuted },
    kycModalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing[6],
    },
    kycModalCard: {
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: radii.large,
      padding: spacing[6],
      alignItems: "center",
      gap: spacing[2],
    },
    kycModalIcon: {
      width: 72,
      height: 72,
      borderRadius: radii.large,
      backgroundColor: colors.primaryBg,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: spacing[1],
    },
    kycModalTitle: {
      ...typography.title2,
      color: colors.text,
      textAlign: "center",
    },
    kycModalBody: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: spacing[1],
      marginBottom: spacing[2],
    },
    kycModalPrimaryBtn: {
      width: "100%",
      minHeight: 48,
      backgroundColor: colors.primary,
      borderRadius: radii.medium,
      alignItems: "center",
      justifyContent: "center",
    },
    kycModalPrimaryBtnText: {
      ...typography.bodyStrong,
      color: colors.textOnPrimary,
    },
    kycModalSecondaryBtn: {
      width: "100%",
      minHeight: 44,
      paddingVertical: spacing[3],
      justifyContent: "center",
      alignItems: "center",
    },
    kycModalSecondaryBtnText: {
      ...typography.caption,
      color: colors.textMuted,
    },
  });
}
