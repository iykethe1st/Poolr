import { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { HTTPError } from "ky";
import { router } from "expo-router";
import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { useAuth } from "@/context/auth-context";
import { useCurrentUser } from "@/hooks/use-dashboard";
import {
  getBankAccountErrorMessage,
  useBanks,
  useMyBankAccount,
  useRemoveBankAccount,
  useResolveAccount,
  useSaveBankAccount,
} from "@/hooks/use-bank-account";
import { useColors } from "@/lib/colors";
import { initials } from "@/lib/format";
import { tierConfig } from "@/lib/tier";
import { StatusBadge } from "@/components/status-badge";
import type { BadgeVariant } from "@/components/status-badge";
import { Text } from "@/components/ui/text";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme, spacing, radii, typography } from "@/theme";

export default function SettingsScreen() {
  const { logout } = useAuth();
  const { data: me, isLoading: meLoading } = useCurrentUser();
  const { data: bankAccount } = useMyBankAccount();
  const { preference, setTheme } = useTheme();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const kycStatus = me?.kycProfile?.kycStatus ?? "UNVERIFIED";
  const KYC_VARIANT: Record<string, { variant: BadgeVariant; label: string }> =
    {
      VERIFIED: { variant: "success", label: "✓ Verified" },
      PENDING: { variant: "warning", label: "Pending" },
      UNVERIFIED: { variant: "danger", label: "Unverified" },
      FAILED: { variant: "danger", label: "Failed" },
    };
  const kycBadge = KYC_VARIANT[kycStatus] ?? KYC_VARIANT.UNVERIFIED;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.screenHeader}>
        <Text variant="title1">Settings</Text>
        <Text variant="body" tone="secondary">
          Your profile, security, and account preferences.
        </Text>
      </View>

      {/* Profile */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {meLoading ? (
            <Skeleton style={styles.avatarSkeleton} />
          ) : (
            <Text variant="title2" tone="brand">
              {me ? initials(me.fullName) : "—"}
            </Text>
          )}
        </View>
        <View style={styles.profileInfo}>
          {meLoading ? (
            <>
              <Skeleton style={styles.profileNameSkeleton} />
              <Skeleton style={styles.profileEmailSkeleton} />
            </>
          ) : (
            <>
              <Text variant="headline" numberOfLines={1}>
                {me?.fullName ?? "Profile unavailable"}
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {me?.email ?? "Check your connection and refresh."}
              </Text>
            </>
          )}
        </View>
        {me && !meLoading && (
          <View style={styles.kycBadgeWrap}>
            <StatusBadge label={kycBadge.label} variant={kycBadge.variant} />
          </View>
        )}
      </View>

      {/* Tier card */}
      {me?.contributionStats && (
        <View
          style={[
            styles.tierCard,
            {
              backgroundColor: colors.primarySubtle,
              borderColor: colors.borderInput,
            },
          ]}
        >
          <View style={styles.tierRow}>
            <View
              style={[styles.tierIconWrap, { backgroundColor: colors.surface }]}
            >
              <Feather
                name={tierConfig(me.contributionStats.tier).icon}
                size={18}
                color={colors.primary}
              />
            </View>
            <View style={styles.tierInfo}>
              <Text style={styles.tierLabel}>
                {tierConfig(me.contributionStats.tier).label} member
              </Text>
              {me.contributionStats.totalPaid > 0 ? (
                <Text style={styles.tierStats}>
                  {me.contributionStats.totalPaid} contribution
                  {me.contributionStats.totalPaid !== 1 ? "s" : ""} ·{" "}
                  {me.contributionStats.onTimeRate}% on time
                  {me.contributionStats.totalPenalties > 0
                    ? ` · ${me.contributionStats.totalPenalties} penalty`
                    : ""}
                </Text>
              ) : (
                <Text style={styles.tierStats}>
                  Make your first contribution to earn a tier
                </Text>
              )}
            </View>
            <View style={styles.trustScore}>
              <Text variant="bodyStrong" tone="brand" tabularNumbers>
                {me.contributionStats.trustScore}
              </Text>
              <Text variant="overline" tone="secondary">
                Trust score
              </Text>
            </View>
          </View>
          {me.contributionStats.tier !== "Elite" && (
            <Text style={styles.tierNext}>
              {me.contributionStats.tier === "New" &&
                `Reach a trust score of 40 to become Trusted`}
              {me.contributionStats.tier === "Trusted" &&
                `Reach a trust score of 60 to become Reliable`}
              {me.contributionStats.tier === "Reliable" &&
                `Reach a trust score of 80 to become Elite`}
            </Text>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text variant="title2">Appearance</Text>
        <Text variant="caption" tone="secondary">
          Choose how Poolr looks on this device.
        </Text>
        <View style={styles.themeOptions}>
          {(
            [
              ["system", "System", "smartphone"],
              ["light", "Light", "sun"],
              ["dark", "Dark", "moon"],
            ] as const
          ).map(([value, label, icon]) => {
            const selected = preference === value;
            return (
              <TouchableOpacity
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${label} theme`}
                style={[
                  styles.themeOption,
                  selected && styles.themeOptionSelected,
                ]}
                onPress={() => setTheme(value)}
                activeOpacity={0.75}
              >
                <Feather
                  name={icon}
                  size={18}
                  color={selected ? colors.primary : colors.iconMuted}
                />
                <Text variant="caption" tone={selected ? "brand" : "secondary"}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* KYC section */}
      {me && !meLoading && kycStatus !== "VERIFIED" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identity verification</Text>
          <Text style={styles.sectionDesc}>
            Required to create and join savings groups.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              kycStatus === "PENDING"
                ? "Identity verification in review"
                : "Verify your identity"
            }
            style={[
              styles.kycRow,
              kycStatus === "PENDING"
                ? styles.kycRowPending
                : styles.kycRowAction,
            ]}
            onPress={() => router.push("/kyc")}
            disabled={kycStatus === "PENDING"}
            activeOpacity={0.8}
          >
            <View style={styles.kycRowIcon}>
              {kycStatus === "PENDING" ? (
                <Feather name="clock" size={20} color={colors.warning} />
              ) : (
                <Feather name="shield" size={20} color={colors.primary} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kycRowTitle}>
                {kycStatus === "PENDING"
                  ? "Verification in review"
                  : "Verify your identity"}
              </Text>
              <Text style={styles.kycRowSub}>
                {kycStatus === "PENDING"
                  ? "We'll notify you when approved"
                  : "Takes ~2 minutes · Government ID required"}
              </Text>
            </View>
            {kycStatus !== "PENDING" && (
              <Feather
                name="chevron-right"
                size={20}
                color={colors.iconMuted}
              />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Bank account section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Withdrawal account</Text>
        <Text style={styles.sectionDesc}>
          Bank account where wallet withdrawals are sent. Must be in your name.
        </Text>
        <BankAccountSection account={bankAccount} />
      </View>

      {/* Help & Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help & Support</Text>
        <View style={styles.supportCard}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Email Poolr support"
            style={styles.supportRow}
            onPress={() => void Linking.openURL("mailto:support@poolr.app")}
          >
            <Feather name="mail" size={16} color={colors.textMuted} />
            <Text style={styles.supportRowText}>Email support</Text>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.supportDivider} />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Contact Poolr support on WhatsApp"
            style={styles.supportRow}
            onPress={() => void Linking.openURL("https://wa.me/2348000000000")}
          >
            <FontAwesome5 name="whatsapp" size={16} color={colors.success} />
            <Text style={styles.supportRowText}>WhatsApp support</Text>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign out */}
      <View style={styles.section}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={styles.signOutBtn}
          onPress={() => {
            Alert.alert("Sign out", "Are you sure you want to sign out?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign out",
                style: "destructive",
                onPress: () => void logout(),
              },
            ]);
          }}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function BankAccountSection({
  account,
}: {
  account:
    | { bankName: string; accountNumber: string; accountName: string }
    | null
    | undefined;
}) {
  const remove = useRemoveBankAccount();
  const [showForm, setShowForm] = useState(false);
  const [accountRevealed, setAccountRevealed] = useState(false);

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (account && !showForm) {
    return (
      <View style={styles.bankCard}>
        <View style={styles.bankRow}>
          <View style={styles.bankCheckIcon}>
            <Feather name="check" size={18} color={colors.success} />
          </View>
          <View style={styles.bankInfo}>
            <Text style={styles.bankName}>{account.accountName}</Text>
            <Text style={styles.bankSub}>{account.bankName}</Text>
            <View style={styles.accountNumberRow}>
              <Text variant="caption" tone="secondary" tabularNumbers>
                {accountRevealed
                  ? account.accountNumber
                  : `•••• ${account.accountNumber.slice(-4)}`}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  accountRevealed
                    ? "Hide bank account number"
                    : "Reveal bank account number"
                }
                onPress={() => setAccountRevealed((revealed) => !revealed)}
                style={styles.accountRevealButton}
              >
                <Feather
                  name={accountRevealed ? "eye-off" : "eye"}
                  size={16}
                  color={colors.iconMuted}
                />
              </TouchableOpacity>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove linked bank account"
            onPress={() => {
              Alert.alert("Remove account", "Remove this bank account?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: () => remove.mutate(),
                },
              ]);
            }}
            disabled={remove.isPending}
            style={styles.removeBtn}
          >
            {remove.isPending ? (
              <ActivityIndicator size="small" color={colors.destructive} />
            ) : (
              <Feather name="x" size={18} color={colors.danger} />
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  if (!account && !showForm) {
    return (
      <View style={styles.emptyBank}>
        <Text style={styles.emptyBankText}>No bank account saved</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add bank account"
          style={styles.addBankBtn}
          onPress={() => setShowForm(true)}
        >
          <Text style={styles.addBankBtnText}>Add bank account</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <AddBankForm
      onSuccess={() => setShowForm(false)}
      onCancel={() => setShowForm(false)}
    />
  );
}

function AddBankForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const {
    data: banks = [],
    isLoading: banksLoading,
    isError: banksFailed,
    error: banksError,
    refetch: refetchBanks,
  } = useBanks();
  const resolve = useResolveAccount();
  const save = useSaveBankAccount();

  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [error, setError] = useState("");

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const selectedBank = banks.find((b) => b.code === bankCode);
  const canResolve = !!bankCode && accountNumber.length === 10;

  async function handleVerify() {
    setError("");
    try {
      const result = await resolve.mutateAsync({ bankCode, accountNumber });
      setResolvedName(result.accountName);
    } catch (err) {
      setError(
        await getBankAccountErrorMessage(
          err,
          "Could not verify account. Check the details and try again.",
        ),
      );
    }
  }

  async function handleSave() {
    setError("");
    try {
      await save.mutateAsync({
        bankCode,
        bankName: selectedBank?.name ?? "",
        accountNumber,
        accountName: resolvedName,
      });
      onSuccess();
    } catch (err) {
      setError(
        await getBankAccountErrorMessage(
          err,
          "Failed to save account. Please try again.",
        ),
      );
    }
  }

  return (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>Add bank account</Text>

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          ⚠ Withdrawals can only be sent to your own account. The name must
          match your verified identity.
        </Text>
      </View>

      {/* Bank picker */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Bank</Text>
        {banksLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : banksFailed ? (
          <View style={styles.bankLoadError}>
            <Text style={styles.errorText}>
              {banksError instanceof HTTPError
                ? `Unable to load banks (server error ${banksError.response.status}).`
                : "Unable to load banks. Check your connection and try again."}
            </Text>
            <Pressable onPress={() => void refetchBanks()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.pickerWrap}>
            <ScrollView style={styles.bankList} nestedScrollEnabled>
              {banks.length === 0 ? (
                <Text style={styles.emptyBanks}>No banks are available.</Text>
              ) : (
                banks.map((b) => (
                  <Pressable
                    key={b.code}
                    style={[
                      styles.bankOption,
                      bankCode === b.code && styles.bankOptionSelected,
                    ]}
                    onPress={() => {
                      setBankCode(b.code);
                      setResolvedName("");
                      setError("");
                    }}
                  >
                    <Text
                      style={[
                        styles.bankOptionText,
                        bankCode === b.code && styles.bankOptionTextSelected,
                      ]}
                    >
                      {b.name}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Account number */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Account number</Text>
        <TextInput
          style={styles.input}
          value={accountNumber}
          onChangeText={(v) => {
            setAccountNumber(v.replace(/\D/g, "").slice(0, 10));
            setResolvedName("");
            setError("");
          }}
          placeholder="10-digit account number"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={10}
          editable={!resolvedName}
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {resolvedName ? (
        <View style={styles.resolvedBox}>
          <Text style={styles.resolvedLabel}>Account name</Text>
          <Text style={styles.resolvedName}>{resolvedName}</Text>
          <Text style={styles.resolvedSub}>
            {selectedBank?.name} · {accountNumber}
          </Text>
          <View style={styles.resolvedActions}>
            <Pressable
              style={[styles.saveBtn, save.isPending && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={save.isPending}
            >
              {save.isPending ? (
                <ActivityIndicator color={colors.textOnPrimary} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save account</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.changeBtn}
              onPress={() => setResolvedName("")}
            >
              <Text style={styles.changeBtnText}>Change</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={[
            styles.verifyBtn,
            (!canResolve || resolve.isPending) && styles.verifyBtnDisabled,
          ]}
          onPress={handleVerify}
          disabled={!canResolve || resolve.isPending}
        >
          {resolve.isPending ? (
            <ActivityIndicator color={colors.textOnPrimary} size="small" />
          ) : (
            <Text style={styles.verifyBtnText}>Verify account</Text>
          )}
        </Pressable>
      )}

      <Pressable style={styles.cancelFormBtn} onPress={onCancel}>
        <Text style={styles.cancelFormBtnText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: import("@/lib/colors").Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: spacing[4],
      paddingTop: spacing[6],
      paddingBottom: spacing[8],
      gap: spacing[6],
    },
    screenHeader: { gap: spacing[1] },

    profileCard: {
      backgroundColor: colors.card,
      borderRadius: radii.large,
      padding: spacing[4],
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[3],
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatar: {
      width: spacing[10] + spacing[3],
      height: spacing[10] + spacing[3],
      borderRadius: radii.large,
      backgroundColor: colors.successBg,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    avatarSkeleton: {
      width: spacing[6],
      height: spacing[6],
      borderRadius: radii.small,
    },
    profileInfo: { flex: 1, gap: spacing[1] },
    profileNameSkeleton: {
      width: "78%",
      height: spacing[4],
      borderRadius: radii.small,
    },
    profileEmailSkeleton: {
      width: "94%",
      height: spacing[3],
      borderRadius: radii.small,
    },
    kycBadgeWrap: { alignItems: "flex-end", flexShrink: 0 },
    tierCard: {
      borderRadius: radii.large,
      padding: spacing[4],
      borderWidth: 1,
      gap: spacing[3],
    },
    tierRow: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
    tierIconWrap: {
      width: spacing[10],
      height: spacing[10],
      borderRadius: radii.medium,
      alignItems: "center",
      justifyContent: "center",
    },
    tierInfo: { flex: 1, gap: spacing[1] },
    trustScore: {
      alignItems: "flex-end",
      gap: spacing[1],
      paddingLeft: spacing[2],
    },
    tierLabel: { ...typography.bodyStrong, color: colors.primary },
    tierStats: { ...typography.caption, color: colors.textSecondary },
    tierNext: { ...typography.caption, color: colors.primary },

    section: { gap: spacing[2] },
    sectionTitle: { ...typography.title2, color: colors.textPrimary },
    sectionDesc: { ...typography.caption, color: colors.textSecondary },
    themeOptions: {
      flexDirection: "row",
      gap: spacing[2],
      padding: spacing[1],
      borderRadius: radii.medium,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
    },
    themeOption: {
      flex: 1,
      minHeight: spacing[10] + spacing[1],
      alignItems: "center",
      justifyContent: "center",
      gap: spacing[1],
      borderRadius: radii.small,
    },
    themeOptionSelected: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderInput,
    },
    kycRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: radii.medium,
      padding: spacing[4],
      gap: spacing[3],
      borderWidth: 1,
      marginTop: spacing[1],
    },
    kycRowAction: {
      backgroundColor: colors.primaryBg,
      borderColor: colors.primaryBorder,
    },
    kycRowPending: {
      backgroundColor: colors.warningBg,
      borderColor: colors.warning,
    },
    kycRowIcon: {
      width: spacing[10],
      height: spacing[10],
      alignItems: "center",
      justifyContent: "center",
    },
    kycRowTitle: { ...typography.bodyStrong, color: colors.textPrimary },
    kycRowSub: { ...typography.caption, color: colors.textSecondary },
    kycRowArrow: { ...typography.title2, color: colors.textTertiary },
    supportCard: {
      backgroundColor: colors.card,
      borderRadius: radii.medium,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    supportRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[3],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[4],
    },
    supportRowText: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
    },
    supportDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: spacing[4],
    },

    bankCard: {
      backgroundColor: colors.card,
      borderRadius: radii.medium,
      padding: spacing[4],
      borderWidth: 1,
      borderColor: colors.border,
    },
    bankRow: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
    bankCheckIcon: {
      width: spacing[10],
      height: spacing[10],
      borderRadius: radii.medium,
      backgroundColor: colors.successBg,
      alignItems: "center",
      justifyContent: "center",
    },
    bankInfo: { flex: 1, gap: spacing[1] },
    bankName: { ...typography.bodyStrong, color: colors.textPrimary },
    bankSub: { ...typography.caption, color: colors.textSecondary },
    accountNumberRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[2],
    },
    accountRevealButton: {
      width: spacing[10] + spacing[1],
      height: spacing[10] + spacing[1],
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.small,
    },
    removeBtn: {
      width: spacing[10] + spacing[1],
      height: spacing[10] + spacing[1],
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.medium,
      backgroundColor: colors.dangerSubtle,
    },

    emptyBank: {
      backgroundColor: colors.card,
      borderRadius: radii.medium,
      padding: spacing[5],
      alignItems: "center",
      gap: spacing[3],
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
    },
    emptyBankText: { ...typography.body, color: colors.textSecondary },
    addBankBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[3],
      borderRadius: radii.small,
    },
    addBankBtnText: {
      ...typography.bodyStrong,
      color: colors.textOnPrimary,
    },

    formCard: {
      backgroundColor: colors.card,
      borderRadius: radii.large,
      padding: spacing[4],
      gap: spacing[4],
      borderWidth: 1,
      borderColor: colors.border,
    },
    formTitle: { ...typography.bodyStrong, color: colors.textPrimary },
    warningBox: {
      backgroundColor: colors.warningBg + "10",
      borderRadius: radii.small,
      padding: spacing[3],
      borderWidth: 1,
      borderColor: colors.warning,
    },
    warningText: {
      ...typography.caption,
      color: colors.warningText,
    },
    field: { gap: spacing[2] },
    fieldLabel: { ...typography.bodyStrong, color: colors.textPrimary },
    bankLoadError: { gap: spacing[2] },
    retryText: { ...typography.bodyStrong, color: colors.primary },
    emptyBanks: {
      padding: spacing[3],
      ...typography.body,
      color: colors.textSecondary,
    },
    pickerWrap: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.small,
      overflow: "hidden",
    },
    bankList: { maxHeight: 160 },
    bankOption: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    bankOptionSelected: { backgroundColor: colors.primaryBg },
    bankOptionText: { ...typography.body, color: colors.textPrimary },
    bankOptionTextSelected: { color: colors.primary, fontWeight: "700" },
    input: {
      minHeight: spacing[10] + spacing[2],
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.small,
      paddingHorizontal: spacing[4],
      ...typography.body,
      color: colors.text,
      backgroundColor: colors.inputBg,
    },
    errorText: { ...typography.caption, color: colors.danger },
    resolvedBox: {
      backgroundColor: colors.primaryBg,
      borderRadius: radii.medium,
      padding: spacing[4],
      gap: 4,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    resolvedLabel: {
      ...typography.overline,
      color: colors.primaryTextMid,
      fontWeight: "600",
      textTransform: "uppercase",
    },
    resolvedName: {
      ...typography.bodyStrong,
      color: colors.primaryText,
    },
    resolvedSub: { ...typography.caption, color: colors.primaryTextMid },
    resolvedActions: {
      flexDirection: "row",
      gap: spacing[3],
      marginTop: spacing[2],
    },
    saveBtn: {
      flex: 1,
      minHeight: spacing[10] + spacing[1],
      backgroundColor: colors.primary,
      borderRadius: radii.small,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: {
      ...typography.bodyStrong,
      color: colors.textOnPrimary,
    },
    changeBtn: {
      paddingHorizontal: spacing[4],
      minHeight: spacing[10] + spacing[1],
      borderRadius: radii.small,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    changeBtnText: { ...typography.body, color: colors.textSecondary },
    verifyBtn: {
      minHeight: spacing[10] + spacing[2],
      backgroundColor: colors.primary,
      borderRadius: radii.small,
      alignItems: "center",
      justifyContent: "center",
    },
    verifyBtnDisabled: { opacity: 0.5 },
    verifyBtnText: {
      ...typography.bodyStrong,
      color: colors.textOnPrimary,
    },
    cancelFormBtn: { alignItems: "center", paddingVertical: spacing[2] },
    cancelFormBtnText: { ...typography.body, color: colors.textSecondary },

    signOutBtn: {
      minHeight: spacing[10] + spacing[2],
      backgroundColor: colors.card,
      borderRadius: radii.medium,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.dangerBorder,
    },
    signOutText: { ...typography.bodyStrong, color: colors.danger },
  });
}
