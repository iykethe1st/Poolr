import { useState, useMemo } from 'react';
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
} from 'react-native';
import { HTTPError } from 'ky';
import * as WebBrowser from 'expo-web-browser';
import { useWallet, useWalletTransactions, useTopUpWallet, useVerifyTopUp, useWithdraw } from '@/hooks/use-wallet';
import { useMyBankAccount } from '@/hooks/use-bank-account';
import { useColors } from '@/lib/colors';
import { formatCurrency, timeAgo } from '@/lib/format';

async function extractError(err: unknown): Promise<string> {
  if (err instanceof HTTPError) {
    try {
      const body = await err.response.json() as { message?: string | string[] };
      const msg = body.message;
      if (Array.isArray(msg)) return msg[0];
      if (typeof msg === 'string') return msg;
    } catch {
      // fall through
    }
    return `Server error (${err.response.status})`;
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message);
  }
  return 'Something went wrong. Please try again.';
}

type SheetType = 'topup' | 'withdraw' | null;

export default function WalletScreen() {
  const { data: wallet, isLoading: walletLoading, refetch: refetchWallet } = useWallet();
  const { data: txData, isLoading: txLoading, refetch: refetchTx } = useWalletTransactions();
  const { data: bankAccount } = useMyBankAccount();
  const topUp = useTopUpWallet();
  const verifyTopUp = useVerifyTopUp();
  const withdraw = useWithdraw();

  const [sheet, setSheet] = useState<SheetType>(null);
  const [amount, setAmount] = useState('');

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const balance = parseFloat(wallet?.balance ?? '0');
  const transactions = txData?.items ?? [];

  function onRefresh() {
    void Promise.all([refetchWallet(), refetchTx()]);
  }

  async function handleTopUp() {
    const n = parseFloat(amount);
    if (isNaN(n) || n < 100) {
      Alert.alert('Invalid amount', 'Minimum top-up is ₦100.');
      return;
    }
    try {
      const result = await topUp.mutateAsync(n);
      setSheet(null);
      setAmount('');

      let pollTimer: ReturnType<typeof setTimeout>;
      let attempts = 0;
      const maxAttempts = 6;

      function poll() {
        pollTimer = setTimeout(async () => {
          attempts++;
          try {
            const verified = await verifyTopUp.mutateAsync(result.reference);
            if (verified.status === 'success') {
              WebBrowser.dismissBrowser();
              Alert.alert('Top-up successful', `₦${n.toLocaleString()} added to your wallet.`);
              void refetchWallet();
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
        'poolr://topup-callback',
      );

      clearTimeout(pollTimer!);

      if (browserResult.type === 'success' && browserResult.url) {
        const url = new URL(browserResult.url);
        const ref = url.searchParams.get('reference') ?? result.reference;
        try {
          const verified = await verifyTopUp.mutateAsync(ref);
          if (verified.status === 'success') {
            Alert.alert('Top-up successful', `₦${n.toLocaleString()} added to your wallet.`);
            void refetchWallet();
          } else {
            Alert.alert('Processing', 'Top-up is being processed. Your balance will update shortly.');
          }
        } catch {
          Alert.alert('Processing', 'Top-up is being processed. Your balance will update shortly.');
        }
      }
    } catch (err) {
      const msg = await extractError(err);
      Alert.alert('Top-up failed', msg);
    }
  }

  async function handleWithdraw() {
    const n = parseFloat(amount);
    if (isNaN(n) || n < 100) {
      Alert.alert('Invalid amount', 'Minimum withdrawal is ₦100.');
      return;
    }
    if (n > balance) {
      Alert.alert('Insufficient balance', `Your wallet balance is ${formatCurrency(balance)}.`);
      return;
    }
    if (!bankAccount) {
      Alert.alert('No bank account', 'Please add a bank account in Settings before withdrawing.');
      setSheet(null);
      return;
    }
    try {
      await withdraw.mutateAsync(n);
      setSheet(null);
      setAmount('');
      Alert.alert('Withdrawal initiated', `₦${n.toLocaleString()} will be sent to ${bankAccount.accountName} (${bankAccount.bankName}).`);
    } catch (err) {
      const msg = await extractError(err);
      Alert.alert('Withdrawal failed', msg);
    }
  }

  const isActionLoading = topUp.isPending || verifyTopUp.isPending || withdraw.isPending;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={walletLoading || txLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available balance</Text>
          {walletLoading ? (
            <ActivityIndicator color="#fff" size="large" style={{ marginVertical: 8 }} />
          ) : (
            <Text style={styles.balanceAmount}>{formatCurrency(balance)}</Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => { setAmount(''); setSheet('topup'); }}
            >
              <Text style={styles.actionBtnIcon}>+</Text>
              <Text style={styles.actionBtnText}>Top up</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => { setAmount(''); setSheet('withdraw'); }}
            >
              <Text style={styles.actionBtnIcon}>↑</Text>
              <Text style={styles.actionBtnText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bank account info */}
        {bankAccount ? (
          <View style={styles.bankCard}>
            <Text style={styles.bankLabel}>Withdrawal account</Text>
            <Text style={styles.bankName}>{bankAccount.accountName}</Text>
            <Text style={styles.bankSub}>{bankAccount.bankName} · {bankAccount.accountNumber}</Text>
          </View>
        ) : (
          <View style={[styles.bankCard, styles.bankCardWarning]}>
            <Text style={styles.bankWarningText}>No bank account linked — add one in Settings to withdraw.</Text>
          </View>
        )}

        {/* Transaction history */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction history</Text>
          {txLoading && transactions.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : transactions.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No transactions yet.</Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {transactions.map((tx) => {
                const isCredit = tx.direction === 'CREDIT';
                return (
                  <View key={tx.id} style={styles.txRow}>
                    <View style={[styles.txIcon, isCredit ? styles.txIconCredit : styles.txIconDebit]}>
                      <Text style={{ fontSize: 13 }}>{isCredit ? '↓' : '↑'}</Text>
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txDesc} numberOfLines={1}>
                        {tx.description ?? tx.type.replace(/_/g, ' ')}
                      </Text>
                      <Text style={styles.txDate}>{timeAgo(tx.createdAt)}</Text>
                    </View>
                    <Text style={[styles.txAmount, isCredit ? styles.credit : styles.debit]}>
                      {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom sheet */}
      <Modal
        visible={sheet !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSheet(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdropArea} onPress={() => setSheet(null)} />
            <View style={styles.sheetContainer}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>
                {sheet === 'topup' ? 'Top up wallet' : 'Withdraw funds'}
              </Text>
              <Text style={styles.sheetSub}>
                {sheet === 'topup'
                  ? 'Add funds via Paystack card or bank transfer.'
                  : `Available: ${formatCurrency(balance)}. Sent to ${bankAccount?.accountName ?? 'your bank account'}.`}
              </Text>

              <View style={styles.amountField}>
                <Text style={styles.currencyPrefix}>₦</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'number-pad'}
                  autoFocus
                />
              </View>

              <View style={styles.quickAmounts}>
                {[1000, 5000, 10000, 20000].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={styles.quickBtn}
                    onPress={() => setAmount(String(n))}
                  >
                    <Text style={styles.quickBtnText}>₦{(n / 1000).toFixed(0)}k</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Pressable
                style={[styles.sheetBtn, (!amount || isActionLoading) && styles.sheetBtnDisabled]}
                onPress={sheet === 'topup' ? handleTopUp : handleWithdraw}
                disabled={!amount || isActionLoading}
              >
                {isActionLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.sheetBtnText}>
                    {sheet === 'topup' ? 'Continue to payment' : 'Withdraw'}
                  </Text>
                )}
              </Pressable>
              {sheet === 'topup' && (
                <Text style={styles.paystackBadge}>🔒 Payments secured by Paystack</Text>
              )}
              <Pressable style={styles.cancelBtn} onPress={() => setSheet(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(colors: import('@/lib/colors').Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingTop: 56, gap: 16 },

    balanceCard: { backgroundColor: colors.primary, borderRadius: 20, padding: 24, gap: 12 },
    balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
    balanceAmount: { fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -1 },
    actions: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, overflow: 'hidden' },
    actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
    actionDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
    actionBtnIcon: { fontSize: 18, color: '#fff', fontWeight: '700' },
    actionBtnText: { fontSize: 12, color: '#fff', fontWeight: '600' },

    bankCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 3,
    },
    bankCardWarning: { borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg },
    bankLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    bankName: { fontSize: 15, fontWeight: '700', color: colors.text },
    bankSub: { fontSize: 13, color: colors.textMuted },
    bankWarningText: { fontSize: 13, color: colors.dangerText },

    section: { gap: 10 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    empty: { backgroundColor: colors.card, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    emptyText: { fontSize: 14, color: colors.textMuted },
    txList: { gap: 8 },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    txIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    txIconCredit: { backgroundColor: colors.successBg },
    txIconDebit: { backgroundColor: colors.dangerBg },
    txInfo: { flex: 1, gap: 2 },
    txDesc: { fontSize: 13, fontWeight: '600', color: colors.text },
    txDate: { fontSize: 11, color: colors.textMuted },
    txAmount: { fontSize: 14, fontWeight: '700' },
    credit: { color: colors.successText },
    debit: { color: colors.dangerText },

    modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    backdropArea: { flex: 1 },
    sheetContainer: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: Platform.OS === 'ios' ? 32 : 24,
      gap: 14,
    },
    sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 99, alignSelf: 'center', marginBottom: 4 },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    sheetSub: { fontSize: 13, color: colors.textMuted, marginTop: -6, lineHeight: 18 },
    amountField: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, height: 60 },
    currencyPrefix: { fontSize: 22, fontWeight: '700', color: colors.textMuted, marginRight: 4 },
    amountInput: { flex: 1, fontSize: 28, fontWeight: '700', color: colors.text },
    quickAmounts: { flexDirection: 'row', gap: 8 },
    quickBtn: { flex: 1, backgroundColor: colors.primaryBg, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.primaryBorder },
    quickBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    sheetBtn: { height: 50, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    sheetBtnDisabled: { opacity: 0.5 },
    sheetBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    paystackBadge: { textAlign: 'center', fontSize: 11, color: colors.textMuted },
    cancelBtn: { alignItems: 'center', paddingVertical: 4 },
    cancelBtnText: { fontSize: 14, color: colors.textMuted },
  });
}
