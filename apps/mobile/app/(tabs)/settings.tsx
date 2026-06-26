import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { useCurrentUser } from '@/hooks/use-dashboard';
import {
  useBanks,
  useMyBankAccount,
  useRemoveBankAccount,
  useResolveAccount,
  useSaveBankAccount,
} from '@/hooks/use-bank-account';
import { useColors } from '@/lib/colors';
import { initials } from '@/lib/format';
import { tierConfig } from '@/lib/tier';
import { StatusBadge } from '@/components/status-badge';
import type { BadgeVariant } from '@/components/status-badge';

export default function SettingsScreen() {
  const { logout } = useAuth();
  const { data: me } = useCurrentUser();
  const { data: bankAccount } = useMyBankAccount();

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const kycStatus = me?.kycProfile?.kycStatus ?? 'UNVERIFIED';
  const KYC_VARIANT: Record<string, { variant: BadgeVariant; label: string }> = {
    VERIFIED:   { variant: 'success', label: '✓ Verified' },
    PENDING:    { variant: 'warning', label: 'Pending' },
    UNVERIFIED: { variant: 'danger',  label: 'Unverified' },
    FAILED:     { variant: 'danger',  label: 'Failed' },
  };
  const kycBadge = KYC_VARIANT[kycStatus] ?? KYC_VARIANT.UNVERIFIED;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Profile */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {me ? initials(me.fullName) : '—'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {me?.fullName ?? '—'}
          </Text>
          <Text style={styles.profileEmail}>{me?.email ?? '—'}</Text>
        </View>
        <StatusBadge label={kycBadge.label} variant={kycBadge.variant} />
      </View>

      {/* Tier card */}
      {me?.contributionStats && (
        <View style={[styles.tierCard, { backgroundColor: tierConfig(me.contributionStats.tier).bg, borderColor: tierConfig(me.contributionStats.tier).color + '40' }]}>
          <View style={styles.tierRow}>
            <Text style={styles.tierEmoji}>{tierConfig(me.contributionStats.tier).emoji}</Text>
            <View style={styles.tierInfo}>
              <Text style={[styles.tierLabel, { color: tierConfig(me.contributionStats.tier).color }]}>
                {tierConfig(me.contributionStats.tier).label} member
              </Text>
              {me.contributionStats.totalPaid > 0 ? (
                <Text style={styles.tierStats}>
                  {me.contributionStats.totalPaid} contribution{me.contributionStats.totalPaid !== 1 ? 's' : ''} · {me.contributionStats.onTimeRate}% on time
                  {me.contributionStats.totalPenalties > 0 ? ` · ${me.contributionStats.totalPenalties} penalty` : ''}
                </Text>
              ) : (
                <Text style={styles.tierStats}>Make your first contribution to earn a tier</Text>
              )}
            </View>
          </View>
          {me.contributionStats.tier !== 'PLATINUM' && (
            <Text style={[styles.tierNext, { color: tierConfig(me.contributionStats.tier).color }]}>
              {me.contributionStats.tier === 'NEW' && 'Pay 1 contribution to reach Bronze'}
              {me.contributionStats.tier === 'BRONZE' && `Pay ${Math.max(0, 5 - me.contributionStats.totalPaid)} more on time to reach Silver`}
              {me.contributionStats.tier === 'SILVER' && `Pay ${Math.max(0, 10 - me.contributionStats.totalPaid)} more (≥90% on time) for Gold`}
              {me.contributionStats.tier === 'GOLD' && `Pay ${Math.max(0, 15 - me.contributionStats.totalPaid)} more (100% on time) for Platinum`}
            </Text>
          )}
        </View>
      )}

      {/* KYC section */}
      {kycStatus !== 'VERIFIED' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identity verification</Text>
          <Text style={styles.sectionDesc}>
            Required to create and join savings groups.
          </Text>
          <TouchableOpacity
            style={[
              styles.kycRow,
              kycStatus === 'PENDING' ? styles.kycRowPending : styles.kycRowAction,
            ]}
            onPress={() => router.push('/kyc')}
            disabled={kycStatus === 'PENDING'}
            activeOpacity={0.8}
          >
            <Text style={styles.kycRowIcon}>
              {kycStatus === 'PENDING' ? '⏳' : '🪪'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.kycRowTitle}>
                {kycStatus === 'PENDING' ? 'Verification in review' : 'Verify your identity'}
              </Text>
              <Text style={styles.kycRowSub}>
                {kycStatus === 'PENDING'
                  ? 'We'll notify you when approved'
                  : 'Takes ~2 minutes · Government ID required'}
              </Text>
            </View>
            {kycStatus !== 'PENDING' && <Text style={styles.kycRowArrow}>›</Text>}
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
            style={styles.supportRow}
            onPress={() => void Linking.openURL('mailto:support@poolr.app')}
          >
            <Text style={styles.supportRowText}>✉️  Email support</Text>
            <Text style={styles.supportRowArrow}>›</Text>
          </TouchableOpacity>
          <View style={styles.supportDivider} />
          <TouchableOpacity
            style={styles.supportRow}
            onPress={() => void Linking.openURL('https://wa.me/2348000000000')}
          >
            <Text style={styles.supportRowText}>💬  WhatsApp chat</Text>
            <Text style={styles.supportRowArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign out */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={() => {
            Alert.alert('Sign out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
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
  account: { bankName: string; accountNumber: string; accountName: string } | null | undefined;
}) {
  const remove = useRemoveBankAccount();
  const [showForm, setShowForm] = useState(false);

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (account && !showForm) {
    return (
      <View style={styles.bankCard}>
        <View style={styles.bankRow}>
          <View style={styles.bankCheckIcon}>
            <Text style={{ color: '#166534', fontWeight: '700' }}>✓</Text>
          </View>
          <View style={styles.bankInfo}>
            <Text style={styles.bankName}>{account.accountName}</Text>
            <Text style={styles.bankSub}>{account.bankName} · {account.accountNumber}</Text>
          </View>
          <Pressable
            onPress={() => {
              Alert.alert('Remove account', 'Remove this bank account?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
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
              <Text style={styles.removeBtnText}>✕</Text>
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
        <Pressable style={styles.addBankBtn} onPress={() => setShowForm(true)}>
          <Text style={styles.addBankBtnText}>Add bank account</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <AddBankForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
  );
}

function AddBankForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const { data: banks = [], isLoading: banksLoading } = useBanks();
  const resolve = useResolveAccount();
  const save = useSaveBankAccount();

  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedName, setResolvedName] = useState('');
  const [error, setError] = useState('');

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const selectedBank = banks.find((b) => b.code === bankCode);
  const canResolve = !!bankCode && accountNumber.length === 10;

  async function handleVerify() {
    setError('');
    try {
      const result = await resolve.mutateAsync({ bankCode, accountNumber });
      setResolvedName(result.accountName);
    } catch {
      setError('Could not verify account. Check the details and try again.');
    }
  }

  async function handleSave() {
    setError('');
    try {
      await save.mutateAsync({
        bankCode,
        bankName: selectedBank?.name ?? '',
        accountNumber,
        accountName: resolvedName,
      });
      onSuccess();
    } catch {
      setError('Failed to save account. Please try again.');
    }
  }

  return (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>Add bank account</Text>

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          ⚠ Withdrawals can only be sent to your own account. The name must match your verified identity.
        </Text>
      </View>

      {/* Bank picker */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Bank</Text>
        {banksLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View style={styles.pickerWrap}>
            {banks.slice(0, 1).map(() => null)}
            <ScrollView style={styles.bankList} nestedScrollEnabled>
              {banks.map((b) => (
                <Pressable
                  key={b.code}
                  style={[styles.bankOption, bankCode === b.code && styles.bankOptionSelected]}
                  onPress={() => { setBankCode(b.code); setResolvedName(''); setError(''); }}
                >
                  <Text style={[styles.bankOptionText, bankCode === b.code && styles.bankOptionTextSelected]}>
                    {b.name}
                  </Text>
                </Pressable>
              ))}
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
          onChangeText={(v) => { setAccountNumber(v.replace(/\D/g, '').slice(0, 10)); setResolvedName(''); setError(''); }}
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
          <Text style={styles.resolvedSub}>{selectedBank?.name} · {accountNumber}</Text>
          <View style={styles.resolvedActions}>
            <Pressable
              style={[styles.saveBtn, save.isPending && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={save.isPending}
            >
              {save.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save account</Text>}
            </Pressable>
            <Pressable style={styles.changeBtn} onPress={() => setResolvedName('')}>
              <Text style={styles.changeBtnText}>Change</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={[styles.verifyBtn, (!canResolve || resolve.isPending) && styles.verifyBtnDisabled]}
          onPress={handleVerify}
          disabled={!canResolve || resolve.isPending}
        >
          {resolve.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.verifyBtnText}>Verify account</Text>}
        </Pressable>
      )}

      <Pressable style={styles.cancelFormBtn} onPress={onCancel}>
        <Text style={styles.cancelFormBtnText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: import('@/lib/colors').Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingTop: 56, gap: 20 },

    profileCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.successBg,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarText: { fontSize: 20, fontWeight: '700', color: colors.primary },
    profileInfo: { flex: 1, gap: 2 },
    profileName: { fontSize: 16, fontWeight: '700', color: colors.text },
    profileEmail: { fontSize: 13, color: colors.textMuted },
    tierCard: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 8 },
    tierRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    tierEmoji: { fontSize: 28 },
    tierInfo: { flex: 1, gap: 2 },
    tierLabel: { fontSize: 15, fontWeight: '700' },
    tierStats: { fontSize: 12, color: colors.textMuted },
    tierNext: { fontSize: 12, fontWeight: '500', opacity: 0.75 },

    section: { gap: 10 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    sectionDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    kycRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      marginTop: 6,
    },
    kycRowAction: {
      backgroundColor: colors.primaryBg,
      borderColor: colors.primaryBorder,
    },
    kycRowPending: {
      backgroundColor: colors.warningBg,
      borderColor: colors.warning + '40',
    },
    kycRowIcon: { fontSize: 28 },
    kycRowTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    kycRowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    kycRowArrow: { fontSize: 22, color: colors.textMuted },
    supportCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    supportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
    supportRowText: { fontSize: 14, color: colors.text },
    supportRowArrow: { fontSize: 18, color: colors.textMuted },
    supportDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },

    bankCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    bankCheckIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.successBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bankInfo: { flex: 1, gap: 2 },
    bankName: { fontSize: 14, fontWeight: '700', color: colors.text },
    bankSub: { fontSize: 12, color: colors.textMuted },
    removeBtn: { padding: 8 },
    removeBtnText: { fontSize: 16, color: colors.destructive },

    emptyBank: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 20,
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    emptyBankText: { fontSize: 14, color: colors.textMuted },
    addBankBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
    addBankBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    formCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    formTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    warningBox: { backgroundColor: colors.warningBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#fde68a' },
    warningText: { fontSize: 12, color: colors.warningText, lineHeight: 17 },
    field: { gap: 6 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
    pickerWrap: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
    bankList: { maxHeight: 160 },
    bankOption: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    bankOptionSelected: { backgroundColor: colors.primaryBg },
    bankOptionText: { fontSize: 14, color: colors.text },
    bankOptionTextSelected: { color: colors.primary, fontWeight: '700' },
    input: {
      height: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.inputBg,
    },
    errorText: { fontSize: 13, color: colors.destructive },
    resolvedBox: { backgroundColor: colors.primaryBg, borderRadius: 12, padding: 14, gap: 4, borderWidth: 1, borderColor: colors.primaryBorder },
    resolvedLabel: { fontSize: 11, color: colors.primaryTextMid, fontWeight: '600', textTransform: 'uppercase' },
    resolvedName: { fontSize: 15, fontWeight: '700', color: colors.primaryText },
    resolvedSub: { fontSize: 12, color: colors.primaryTextMid },
    resolvedActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    saveBtn: { flex: 1, height: 42, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    changeBtn: { paddingHorizontal: 14, height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    changeBtnText: { fontSize: 14, color: colors.textMuted },
    verifyBtn: { height: 46, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    verifyBtnDisabled: { opacity: 0.5 },
    verifyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    cancelFormBtn: { alignItems: 'center', paddingVertical: 8 },
    cancelFormBtnText: { fontSize: 14, color: colors.textMuted },

    signOutBtn: {
      height: 48,
      backgroundColor: colors.card,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.dangerBorder,
    },
    signOutText: { fontSize: 15, fontWeight: '700', color: colors.destructive },
  });
}
