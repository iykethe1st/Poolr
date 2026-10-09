import { useState, useMemo } from "react";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { HTTPError } from "ky";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  useWallet,
  useWalletTransactions,
  useTopUpWallet,
  useVerifyTopUp,
  useWithdraw,
} from "@/hooks/use-wallet";
import { useMyBankAccount } from "@/hooks/use-bank-account";
import { useColors } from "@/lib/colors";
import { formatCurrency, timeAgo } from "@/lib/format";
import { AddBankForm } from "@/components/add-bank-form";
import { AmountInput } from "@/components/ui/amount-input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { radii, spacing, typography } from "@/theme";

async function extractError(err: unknown): Promise<string> {
  if (err instanceof HTTPError) {
    try {
      const body = (await err.response.json()) as {
        message?: string | string[];
      };
      const msg = body.message;
      if (Array.isArray(msg)) return msg[0];
      if (typeof msg === "string") return msg;
    } catch {
      // fall through
    }
    return `Server error (${err.response.status})`;
  }
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: string }).message);
  }
  return "Something went wrong. Please try again.";
}

type SheetType = "topup" | "withdraw" | "link-bank" | null;

export default function WalletScreen() {
  const {
    data: wallet,
    isLoading: walletLoading,
    isError: walletFailed,
    refetch: refetchWallet,
  } = useWallet();
  const {
    data: txData,
    isLoading: txLoading,
    isError: transactionsFailed,
    refetch: refetchTx,
  } = useWalletTransactions();
  const { data: bankAccount } = useMyBankAccount();
  const topUp = useTopUpWallet();
  const verifyTopUp = useVerifyTopUp();
  const withdraw = useWithdraw();

  const [sheet, setSheet] = useState<SheetType>(null);
  const [amount, setAmount] = useState("");
  const [accountRevealed, setAccountRevealed] = useState(false);

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const balance = parseFloat(wallet?.balance ?? "0");
  const transactions = txData?.items ?? [];

  function onRefresh() {
    void Promise.all([refetchWallet(), refetchTx()]);
  }

  async function handleTopUp() {
    const n = parseFloat(amount);
    if (isNaN(n) || n < 100) {
      Alert.alert("Invalid amount", "Minimum top-up is ₦100.");
      return;
    }
    try {
      const result = await topUp.mutateAsync(n);
      setSheet(null);
      setAmount("");

      let pollTimer: ReturnType<typeof setTimeout>;
      let attempts = 0;
      const maxAttempts = 6;

      function navigateTopUpSuccess(amount: number) {
        void refetchWallet();
        router.replace({
          pathname: "/payment-success",
          params: { type: "topup", amount: String(amount) },
        } as never);
      }

      function poll() {
        pollTimer = setTimeout(async () => {
          attempts++;
          try {
            const verified = await verifyTopUp.mutateAsync(result.reference);
            if (verified.status === "success") {
              WebBrowser.dismissBrowser();
              navigateTopUpSuccess(n);
              return;
            }
          } catch {
            // not yet verified
          }
          if (attempts < maxAttempts) poll();
        }, 5000);
      }

      poll();

      const browserResult = await WebBrowser.openAuthSessionAsync(
        result.authorizationUrl,
        "poolr://topup-callback",
      );

      clearTimeout(pollTimer!);

      if (browserResult.type === "success" && browserResult.url) {
        const url = new URL(browserResult.url);
        const ref = url.searchParams.get("reference") ?? result.reference;
        try {
          const verified = await verifyTopUp.mutateAsync(ref);
          if (verified.status === "success") {
            navigateTopUpSuccess(n);
          } else {
            Alert.alert(
              "Processing",
              "Top-up is being processed. Your balance will update shortly.",
            );
          }
        } catch {
          Alert.alert(
            "Processing",
            "Top-up is being processed. Your balance will update shortly.",
          );
        }
      }
    } catch (err) {
      const msg = await extractError(err);
      Alert.alert("Top-up failed", msg);
    }
  }

  async function handleWithdraw() {
    const n = parseFloat(amount);
    if (isNaN(n) || n < 100) {
      Alert.alert("Invalid amount", "Minimum withdrawal is ₦100.");
      return;
    }
    if (n > balance) {
      Alert.alert(
        "Insufficient balance",
        `Your wallet balance is ${formatCurrency(balance)}.`,
      );
      return;
    }
    if (!bankAccount) {
      setSheet("link-bank");
      return;
    }
    try {
      await withdraw.mutateAsync(n);
      setSheet(null);
      setAmount("");
      Alert.alert(
        "Withdrawal initiated",
        `₦${n.toLocaleString()} will be sent to ${bankAccount.accountName} (${bankAccount.bankName}).`,
      );
    } catch (err) {
      const msg = await extractError(err);
      Alert.alert("Withdrawal failed", msg);
    }
  }

  const isActionLoading =
    topUp.isPending || verifyTopUp.isPending || withdraw.isPending;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={walletLoading || txLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.screenHeader}>
          <Text variant="title1">Wallet</Text>
          <Text variant="body" tone="secondary">
            Manage your balance, bank account, and recent activity.
          </Text>
        </View>

        {/* Balance card */}
        {walletFailed && !wallet ? (
          <ErrorState
            title="Wallet unavailable"
            action={
              <Button
                accessibilityLabel="Retry loading wallet"
                variant="secondary"
                onPress={() => void refetchWallet()}
              >
                Try again
              </Button>
            }
          >
            Check your connection and try loading your wallet again.
          </ErrorState>
        ) : (
          <View style={styles.balanceCard}>
            <Text
              variant="caption"
              tone="onPrimary"
              style={styles.balanceLabel}
            >
              Available balance
            </Text>
            {walletLoading ? (
              <Skeleton style={styles.balanceSkeleton} />
            ) : (
              <Text
                variant="display"
                tone="onPrimary"
                tabularNumbers
                style={styles.balanceAmount}
              >
                {formatCurrency(balance)}
              </Text>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Top up wallet"
                style={styles.actionBtn}
                onPress={() => {
                  setAmount("");
                  setSheet("topup");
                }}
              >
                <Feather
                  name="plus-circle"
                  size={22}
                  color={colors.textOnPrimary}
                />
                <Text
                  variant="caption"
                  tone="onPrimary"
                  style={styles.actionBtnText}
                >
                  Top up
                </Text>
              </TouchableOpacity>
              <View style={styles.actionDivider} />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Withdraw from wallet"
                style={styles.actionBtn}
                onPress={() => {
                  setAmount("");
                  setSheet("withdraw");
                }}
              >
                <Feather
                  name="arrow-up-right"
                  size={22}
                  color={colors.textOnPrimary}
                />
                <Text
                  variant="caption"
                  tone="onPrimary"
                  style={styles.actionBtnText}
                >
                  Withdraw
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bank account info */}
        {bankAccount ? (
          <View style={styles.bankCard}>
            <View style={styles.bankHeading}>
              <View style={styles.bankIcon}>
                <Feather name="home" size={18} color={colors.primary} />
              </View>
              <View style={styles.bankHeadingCopy}>
                <Text variant="bodyStrong">Withdrawal account</Text>
                <Text style={styles.bankLabel}>
                  Linked for wallet withdrawals
                </Text>
              </View>
              <Feather name="check-circle" size={18} color={colors.success} />
            </View>
            <Text style={styles.bankName}>{bankAccount.accountName}</Text>
            <View style={styles.bankDetails}>
              <Text style={styles.bankSub}>
                {bankAccount.bankName} ·{" "}
                {accountRevealed
                  ? bankAccount.accountNumber
                  : `••••${bankAccount.accountNumber.slice(-4)}`}
              </Text>
              <IconButton
                accessibilityLabel={
                  accountRevealed
                    ? "Hide account number"
                    : "Reveal account number"
                }
                onPress={() => setAccountRevealed((revealed) => !revealed)}
              >
                <Feather
                  name={accountRevealed ? "eye-off" : "eye"}
                  size={18}
                  color={colors.icon}
                />
              </IconButton>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Link a bank account"
            style={[styles.bankCard, styles.bankCardWarning]}
            onPress={() => setSheet("link-bank")}
            activeOpacity={0.8}
          >
            <Text style={styles.bankWarningText}>
              No bank account linked — tap to add one.
            </Text>
            <Text style={styles.bankWarningLink}>Add bank account →</Text>
          </TouchableOpacity>
        )}

        {/* Transaction history */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionCopy}>
              <Text variant="title2">Recent activity</Text>
              <Text variant="caption" tone="secondary">
                Wallet top-ups and withdrawals.
              </Text>
            </View>
            {transactions.length > 0 && (
              <Text variant="caption" tone="tertiary">
                {txData?.total ?? transactions.length} total
              </Text>
            )}
          </View>
          {txLoading && transactions.length === 0 ? (
            <View style={styles.loadingList}>
              <Skeleton style={styles.loadingRow} />
              <Skeleton style={styles.loadingRow} />
              <Skeleton style={styles.loadingRow} />
            </View>
          ) : transactionsFailed && transactions.length === 0 ? (
            <ErrorState
              title="Transactions unavailable"
              action={
                <Button
                  accessibilityLabel="Retry loading transactions"
                  variant="secondary"
                  onPress={() => void refetchTx()}
                >
                  Try again
                </Button>
              }
            >
              Check your connection and try loading your transactions again.
            </ErrorState>
          ) : transactions.length === 0 ? (
            <EmptyState title="No transactions yet">
              Wallet activity will appear here when you fund or withdraw from
              your wallet.
            </EmptyState>
          ) : (
            <View style={styles.txList}>
              {transactions.map((tx) => {
                const isCredit = tx.direction === "CREDIT";
                return (
                  <View key={tx.id} style={styles.txRow}>
                    <View
                      style={[
                        styles.txIcon,
                        isCredit ? styles.txIconCredit : styles.txIconDebit,
                      ]}
                    >
                      <Feather
                        name={isCredit ? "arrow-down-left" : "arrow-up-right"}
                        size={14}
                        color={isCredit ? colors.success : colors.danger}
                      />
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txDesc} numberOfLines={1}>
                        {tx.description ?? tx.type.replace(/_/g, " ")}
                      </Text>
                      <Text style={styles.txDate}>{timeAgo(tx.createdAt)}</Text>
                    </View>
                    <Text
                      variant="bodyStrong"
                      tone={isCredit ? "success" : "danger"}
                      tabularNumbers
                      style={[styles.txAmount]}
                    >
                      {isCredit ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom sheet */}
      <BottomSheet visible={sheet !== null} onClose={() => setSheet(null)}>
        {sheet === "link-bank" ? (
          <AddBankForm
            onSuccess={() => {
              setSheet("withdraw");
              setAmount("");
            }}
            onCancel={() => setSheet(null)}
          />
        ) : (
          <>
            <Text style={styles.sheetTitle}>
              {sheet === "topup" ? "Top up wallet" : "Withdraw funds"}
            </Text>
            <Text tabularNumbers style={styles.sheetSub}>
              {sheet === "topup"
                ? "Add funds via Paystack card or bank transfer."
                : `Available: ${formatCurrency(balance)}. Sent to ${bankAccount?.accountName ?? "your bank account"}.`}
            </Text>

            <AmountInput
              accessibilityLabel="Amount in naira"
              label="Amount"
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              keyboardType={
                Platform.OS === "ios" ? "decimal-pad" : "number-pad"
              }
              autoFocus
            />

            <View style={styles.quickAmounts}>
              {[1000, 5000, 10000, 20000].map((n) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Set amount to ₦${n.toLocaleString()}`}
                  key={n}
                  style={styles.quickBtn}
                  onPress={() => setAmount(String(n))}
                >
                  <Text
                    variant="caption"
                    tabularNumbers
                    style={styles.quickBtnText}
                  >
                    ₦{(n / 1000).toFixed(0)}k
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              accessibilityLabel={
                sheet === "topup" ? "Continue to payment" : "Withdraw"
              }
              style={styles.sheetBtn}
              onPress={sheet === "topup" ? handleTopUp : handleWithdraw}
              disabled={!amount || isActionLoading}
              loading={isActionLoading}
            >
              {sheet === "topup" ? "Continue to payment" : "Withdraw"}
            </Button>
            {sheet === "topup" && (
              <Text style={styles.paystackBadge}>
                Payments are processed securely by Paystack.
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={styles.cancelBtn}
              onPress={() => setSheet(null)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </>
        )}
      </BottomSheet>
    </View>
  );
}

function createStyles(colors: import("@/lib/colors").Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing[4], paddingTop: spacing[6], gap: spacing[4] },
    screenHeader: { gap: spacing[1] },

    balanceCard: {
      backgroundColor: colors.primary,
      borderRadius: radii.large,
      padding: spacing[6],
      gap: spacing[3],
    },
    balanceLabel: {
      ...typography.caption,
      color: colors.textOnPrimary,
    },
    balanceAmount: {
      color: colors.textOnPrimary,
    },
    balanceSkeleton: {
      width: "70%",
      minHeight: spacing[8],
      backgroundColor: colors.primaryPressed,
    },
    actions: {
      flexDirection: "row",
      backgroundColor: colors.primaryPressed,
      borderRadius: radii.medium,
      overflow: "hidden",
    },
    actionBtn: {
      flex: 1,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing[2],
      gap: spacing[1],
    },
    actionDivider: { width: 1, backgroundColor: colors.textOnPrimary },
    actionBtnText: { ...typography.caption, color: colors.textOnPrimary },

    bankCard: {
      backgroundColor: colors.card,
      borderRadius: radii.large,
      padding: spacing[4],
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing[2],
    },
    bankHeading: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[3],
      marginBottom: spacing[1],
    },
    bankIcon: {
      width: spacing[10],
      height: spacing[10],
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.medium,
      backgroundColor: colors.primarySubtle,
    },
    bankHeadingCopy: { flex: 1, gap: spacing[1] },
    bankCardWarning: {
      borderColor: colors.danger,
      backgroundColor: colors.dangerSubtle,
    },
    bankLabel: { ...typography.caption, color: colors.textSecondary },
    bankName: { ...typography.bodyStrong, color: colors.text },
    bankDetails: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing[2],
    },
    bankSub: { ...typography.caption, color: colors.textMuted, flex: 1 },
    bankWarningText: { ...typography.caption, color: colors.dangerText },
    bankWarningLink: {
      ...typography.caption,
      color: colors.primary,
      marginTop: spacing[1],
    },

    section: { gap: spacing[3] },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing[3],
    },
    sectionCopy: { flex: 1, gap: spacing[1] },
    empty: {
      backgroundColor: colors.card,
      borderRadius: radii.medium,
      padding: spacing[6],
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    txList: { gap: spacing[2] },
    txRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radii.medium,
      padding: spacing[3],
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing[3],
    },
    txIcon: {
      width: spacing[10],
      height: spacing[10],
      borderRadius: radii.medium,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    txIconCredit: { backgroundColor: colors.successBg },
    txIconDebit: { backgroundColor: colors.dangerBg },
    txInfo: { flex: 1, gap: spacing[1] },
    txDesc: { ...typography.caption, color: colors.text },
    txDate: { ...typography.overline, color: colors.textMuted },
    txAmount: { ...typography.bodyStrong, fontVariant: ["tabular-nums"] },

    loadingList: { gap: spacing[3] },
    loadingRow: { height: 64, borderRadius: radii.medium },
    sheetTitle: { ...typography.headline, color: colors.text },
    sheetSub: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: -spacing[2],
    },
    quickAmounts: { flexDirection: "row", gap: spacing[2] },
    quickBtn: {
      flex: 1,
      backgroundColor: colors.primaryBg,
      borderRadius: radii.small,
      minHeight: 44,
      paddingVertical: spacing[2],
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    quickBtnText: { ...typography.caption, color: colors.primary },
    sheetBtn: {
      width: "100%",
    },
    paystackBadge: {
      ...typography.overline,
      textAlign: "center",
      color: colors.textMuted,
    },
    cancelBtn: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelBtnText: { ...typography.caption, color: colors.textMuted },
  });
}
