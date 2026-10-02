import { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMyGroups, useCurrentUser } from "@/hooks/use-dashboard";
import { useDeclineInvite, useJoinGroup } from "@/hooks/use-group";
import { useColors } from "@/lib/colors";
import { formatCurrency } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import type { BadgeVariant } from "@/components/status-badge";

const STATUS_VARIANT: Record<string, { variant: BadgeVariant; label: string }> =
  {
    DRAFT: { variant: "warning", label: "Draft" },
    ACTIVE: { variant: "success", label: "Active" },
    COMPLETED: { variant: "completed", label: "Completed" },
    PAUSED: { variant: "neutral", label: "Paused" },
  };

export default function GroupsScreen() {
  const { data: groups = [], isLoading, refetch } = useMyGroups();
  const { data: me } = useCurrentUser();
  const joinGroup = useJoinGroup();
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const userId = me?.id;
  const myGroups = groups.filter((g) => {
    const m = g.members.find((mb) => mb.userId === userId);
    return !m || m.memberStatus !== "INVITED";
  });
  const pendingInvites = groups.filter((g) => {
    const m = g.members.find((mb) => mb.userId === userId);
    return m?.memberStatus === "INVITED";
  });

  function openJoinModal() {
    if (me?.kycProfile?.kycStatus !== "VERIFIED") {
      Alert.alert(
        "Identity verification required",
        "You need to verify your identity before joining a group.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Verify now", onPress: () => router.push("/kyc") },
        ],
      );
      return;
    }
    setJoinModalVisible(true);
  }

  function extractToken(input: string): string {
    try {
      const url = new URL(input.trim());
      return url.searchParams.get("token") ?? input.trim();
    } catch {
      return input.trim();
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim()) return;
    const token = extractToken(inviteCode);
    try {
      await joinGroup.mutateAsync(token);
      setJoinModalVisible(false);
      setInviteCode("");
      Alert.alert("Joined!", "You have successfully joined the group.");
    } catch {
      Alert.alert("Error", "Invalid or expired invite code. Please try again.");
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => void refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Groups</Text>
            <Text style={styles.subtitle}>
              {myGroups.length} saving circle{myGroups.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.createBtn}
              onPress={() => router.push("/groups/new")}
            >
              <Text style={styles.createBtnText}>+ Create</Text>
            </Pressable>
            <Pressable style={styles.joinBtn} onPress={openJoinModal}>
              <Text style={styles.joinBtnText}>Join</Text>
            </Pressable>
          </View>
        </View>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Pending invites{" "}
              <Text style={styles.inviteBadge}>{pendingInvites.length}</Text>
            </Text>
            {pendingInvites.map((g) => (
              <InviteCard key={g.id} group={g} />
            ))}
          </View>
        )}

        {isLoading && groups.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : myGroups.length === 0 && pendingInvites.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptyText}>
              Join a savings circle using an invite token, or ask your group
              admin.
            </Text>
            <Pressable style={styles.emptyBtn} onPress={openJoinModal}>
              <Text style={styles.emptyBtnText}>Enter invite token</Text>
            </Pressable>
          </View>
        ) : myGroups.length > 0 ? (
          <View
            style={[styles.list, pendingInvites.length > 0 && { marginTop: 0 }]}
          >
            {myGroups.map((g) => {
              const statusConfig =
                STATUS_VARIANT[g.status] ?? STATUS_VARIANT.DRAFT;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={styles.card}
                  onPress={() => router.push(`/groups/${g.id}`)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.avatarWrap}>
                      <Text style={styles.avatarText}>
                        {g.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.cardMeta}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {g.name}
                      </Text>
                      <Text style={styles.cardSub}>
                        {g._count?.members ?? g.members.length}/{g.maxMembers}{" "}
                        members · {g.frequency.toLowerCase()}
                      </Text>
                    </View>
                    <StatusBadge
                      label={statusConfig.label}
                      variant={statusConfig.variant}
                    />
                  </View>
                  <View style={styles.cardFooter}>
                    <View>
                      <Text style={styles.footerLabel}>Contribution</Text>
                      <Text style={styles.footerValue}>
                        {formatCurrency(g.contributionAmount)}
                      </Text>
                    </View>
                    {g.currentCycle !== undefined &&
                      g.totalCycles !== undefined && (
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.footerLabel}>Progress</Text>
                          <Text style={styles.footerValue}>
                            Cycle {g.currentCycle}/{g.totalCycles}
                          </Text>
                        </View>
                      )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      {/* Join group modal */}
      <Modal
        visible={joinModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.backdropArea}
            onPress={() => setJoinModalVisible(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Join a group</Text>
            <Text style={styles.sheetSub}>
              Paste the invite token sent to you via SMS or email from your
              group admin.
            </Text>
            <TextInput
              style={styles.codeInput}
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="Paste invite link or token"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={[
                styles.sheetBtn,
                (!inviteCode.trim() || joinGroup.isPending) &&
                  styles.sheetBtnDisabled,
              ]}
              onPress={handleJoin}
              disabled={!inviteCode.trim() || joinGroup.isPending}
            >
              {joinGroup.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sheetBtnText}>Join group</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.cancelBtn}
              onPress={() => setJoinModalVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function InviteCard({
  group,
}: {
  group: import("@/hooks/use-dashboard").GroupWithMembers;
}) {
  const colors = useColors();
  const inviteStyles = useMemo(() => createInviteStyles(colors), [colors]);
  const decline = useDeclineInvite(group.id);

  function handleDecline() {
    Alert.alert(
      "Decline invite",
      `Are you sure you want to decline the invite to "${group.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: () =>
            decline.mutate(undefined, {
              onError: () =>
                Alert.alert(
                  "Error",
                  "Failed to decline invite. Please try again.",
                ),
            }),
        },
      ],
    );
  }

  return (
    <View style={inviteStyles.card}>
      <TouchableOpacity
        style={inviteStyles.cardTop}
        activeOpacity={0.75}
        onPress={() => router.push(`/groups/invite-review/${group.id}`)}
      >
        <View style={{ flex: 1 }}>
          <Text style={inviteStyles.name} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={inviteStyles.meta}>
            {group.frequency.toLowerCase()} ·{" "}
            {formatCurrency(group.contributionAmount)} per member
          </Text>
        </View>
        <StatusBadge label="Invited" variant="warning" />
      </TouchableOpacity>
      <View style={inviteStyles.actions}>
        <Pressable
          style={inviteStyles.reviewButton}
          onPress={() => router.push(`/groups/invite-review/${group.id}`)}
        >
          <Text style={inviteStyles.reviewText}>Review & accept</Text>
        </Pressable>
        <Pressable
          style={inviteStyles.declineButton}
          onPress={handleDecline}
          disabled={decline.isPending}
        >
          {decline.isPending ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Text style={inviteStyles.declineText}>Decline</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function createInviteStyles(colors: import("@/lib/colors").Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      gap: 10,
      borderWidth: 1.5,
      borderColor: colors.primaryBorder,
      borderStyle: "dashed",
    },
    cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    name: { fontSize: 14, fontWeight: "700", color: colors.text },
    meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    actions: { flexDirection: "row", alignItems: "center", gap: 8 },
    reviewButton: {
      flex: 1,
      minHeight: 40,
      backgroundColor: colors.primary,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    reviewText: { fontSize: 13, fontWeight: "600", color: "#fff" },
    declineButton: {
      minHeight: 40,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    declineText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  });
}

function createStyles(colors: import("@/lib/colors").Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingTop: 56, gap: 16 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: { fontSize: 24, fontWeight: "600", color: colors.text },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    headerActions: { flexDirection: "row", gap: 8 },
    createBtn: {
      borderWidth: 1.5,
      borderColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
    },
    createBtnText: { color: colors.primary, fontWeight: "700", fontSize: 14 },
    joinBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
    },
    joinBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    center: { paddingVertical: 60, alignItems: "center" },
    section: { gap: 10 },
    sectionTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
    inviteBadge: { fontSize: 12, fontWeight: "700", color: colors.primary },
    empty: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 32,
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
      marginTop: 24,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 20,
    },
    emptyBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 10,
      marginTop: 4,
    },
    emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    list: { gap: 12 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatarWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.successBg,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    avatarText: { fontSize: 20, fontWeight: "700", color: colors.primary },
    cardMeta: { flex: 1 },
    cardName: { fontSize: 15, fontWeight: "700", color: colors.text },
    cardSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    cardFooter: { flexDirection: "row", justifyContent: "space-between" },
    footerLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "500" },
    footerValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginTop: 2,
    },

    modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
    backdropArea: { flex: 1 },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: Platform.OS === "ios" ? 32 : 24,
      gap: 14,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 99,
      alignSelf: "center",
      marginBottom: 4,
    },
    sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    sheetSub: { fontSize: 13, color: colors.textMuted, marginTop: -6 },
    codeInput: {
      height: 52,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      fontSize: 13,
      fontWeight: "400",
      color: colors.text,
      backgroundColor: colors.inputBg,
    },
    sheetBtn: {
      height: 50,
      backgroundColor: colors.primary,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetBtnDisabled: { opacity: 0.5 },
    sheetBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    cancelBtn: { alignItems: "center", paddingVertical: 8 },
    cancelBtnText: { fontSize: 14, color: colors.textMuted },
  });
}
