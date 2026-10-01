import { useState, useMemo } from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useCreateGroup } from '@/hooks/use-group';
import { useCurrentUser } from '@/hooks/use-dashboard';
import { useColors } from '@/lib/colors';
import { KycRequiredModal } from '@/components/kyc-required-modal';

const TERMS_SECTIONS = [
  { title: '1. Contribution Commitment', body: 'By creating this group you commit to making your full contribution every cycle for the entire duration. Missing a contribution affects every other member and may result in penalties.' },
  { title: '2. Payout Schedule', body: 'Payouts are distributed to members in the agreed rotation order. Each member receives the full pooled amount exactly once. The order cannot be changed after the group starts.' },
  { title: '3. Default & Loss Sharing', body: 'If a member receives their payout and stops contributing, the shortfall is shared equally among all remaining active members. Poolr cannot recover funds from defaulting members.' },
  { title: '4. Default Protection Fund', body: 'Poolr holds a Default Protection Fund from platform fees that may partially offset verified defaults. It does not guarantee full recovery of losses.' },
  { title: '5. Late Payment Penalties', body: 'Contributions not received by the due date may incur a late penalty of 5% of the contribution amount where penalties are enabled.' },
  { title: '6. Platform Fee', body: 'A platform fee is charged on every contribution. This fee is added to the contribution and is non-refundable. The exact amount is shown before each payment.' },
  { title: '7. No Early Withdrawal', body: 'Once a group has started, contributions cannot be refunded or withdrawn. You are committed for the full duration.' },
  { title: '8. Your Responsibility', body: 'You are solely responsible for ensuring sufficient funds are available on each due date.' },
];

const FREQUENCIES = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Biweekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

export default function NewGroupScreen() {
  const createGroup = useCreateGroup();
  const { data: me, refetch: refreshMe } = useCurrentUser();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [maxMembers, setMaxMembers] = useState('');
  const [startDate, setStartDate] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [kycModalOpen, setKycModalOpen] = useState(false);

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isValid =
    name.trim().length > 0 &&
    Number(amount) >= 100 &&
    Number(maxMembers) >= 3 &&
    Number(maxMembers) <= 50 &&
    termsAccepted;

  async function handleSubmit() {
    if (!isValid) return;
    const userResult = await refreshMe();
    if (userResult.isError) {
      Alert.alert('Unable to check verification', 'Please check your connection and try again.');
      return;
    }
    if (userResult.data?.kycProfile?.kycStatus !== 'VERIFIED') {
      setKycModalOpen(true);
      return;
    }
    try {
      const group = await createGroup.mutateAsync({
        name: name.trim(),
        contributionAmount: Number(amount),
        frequency,
        maxMembers: Number(maxMembers),
        startDate: startDate.trim() || undefined,
        penaltyEnabled: true,
      });
      router.replace(`/groups/${group.id}`);
    } catch {
      Alert.alert('Error', 'Failed to create group. Please check your input and try again.');
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Create group</Text>
      </View>

      <View style={styles.form}>
        <FieldLabel label="Group name" required />
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Office ajo"
          placeholderTextColor={colors.textMuted}
          maxLength={100}
          autoCapitalize="words"
        />

        <FieldLabel label="Contribution amount (₦)" required hint="Min ₦100" />
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="e.g. 10000"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />

        <FieldLabel label="Frequency" required />
        <View style={styles.segmented}>
          {FREQUENCIES.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.segmentItem, frequency === f.value && styles.segmentItemActive]}
              onPress={() => setFrequency(f.value)}
            >
              <Text style={[styles.segmentText, frequency === f.value && styles.segmentTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FieldLabel label="Max members" required hint="3–50" />
        <TextInput
          style={styles.input}
          value={maxMembers}
          onChangeText={setMaxMembers}
          placeholder="e.g. 10"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />

        <FieldLabel label="Start date" hint="Optional — YYYY-MM-DD" />
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="e.g. 2026-08-01"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {maxMembers && Number(maxMembers) > 0 && amount && Number(amount) > 0 && (
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Pot summary</Text>
            <Text style={styles.summaryLine}>
              {maxMembers} members × ₦{Number(amount).toLocaleString()} = ₦{(Number(amount) * Number(maxMembers)).toLocaleString()} per cycle
            </Text>
          </View>
        )}

        {/* Terms acceptance */}
        <TouchableOpacity style={styles.termsRow} onPress={() => setTermsAccepted((v) => !v)} activeOpacity={0.7}>
          <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
            {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.termsText}>
            I agree to the{' '}
            <Text style={styles.termsLink} onPress={() => setTermsModalOpen(true)}>
              Group Savings Circle Terms
            </Text>
            , including default risk, payout schedule, and platform fees.
          </Text>
        </TouchableOpacity>

        <Pressable
          style={[styles.submitBtn, (!isValid || createGroup.isPending) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || createGroup.isPending}
        >
          {createGroup.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Create group</Text>
          )}
        </Pressable>
      </View>

      {/* Terms modal */}
      <Modal visible={termsModalOpen} animationType="slide" onRequestClose={() => setTermsModalOpen(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 20 }}>Group Savings Circle Terms</Text>
          {TERMS_SECTIONS.map((s) => (
            <View key={s.title} style={{ marginBottom: 18 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 }}>{s.title}</Text>
              <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 21 }}>{s.body}</Text>
            </View>
          ))}
          <TouchableOpacity
            style={{ marginTop: 8, height: 50, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => setTermsModalOpen(false)}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Close</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      <KycRequiredModal
        visible={kycModalOpen}
        onClose={() => setKycModalOpen(false)}
        context="create"
        redirectPath="/groups/new"
      />
    </ScrollView>
  );
}

function FieldLabel({ label, required, hint }: { label: string; required?: boolean; hint?: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.fieldLabel}>
      <Text style={styles.fieldLabelText}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

function createStyles(colors: import('@/lib/colors').Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingTop: 56, paddingBottom: 40, gap: 0 },
    header: { marginBottom: 24, gap: 8 },
    backText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
    title: { fontSize: 24, fontWeight: '600', color: colors.text },

    form: { gap: 6 },
    fieldLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16, marginBottom: 4 },
    fieldLabelText: { fontSize: 13, fontWeight: '600', color: colors.text },
    required: { color: '#ef4444' },
    fieldHint: { fontSize: 11, color: colors.textMuted },

    input: {
      height: 50,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.card,
    },

    segmented: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    segmentItem: {
      flex: 1,
      paddingVertical: 11,
      alignItems: 'center',
    },
    segmentItemActive: {
      backgroundColor: colors.primary,
    },
    segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    segmentTextActive: { color: '#fff' },

    summary: {
      backgroundColor: colors.primaryBg,
      borderRadius: 12,
      padding: 14,
      marginTop: 12,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    summaryTitle: { fontSize: 12, fontWeight: '700', color: colors.primaryTextMid },
    summaryLine: { fontSize: 14, fontWeight: '600', color: colors.primaryText },

    submitBtn: {
      height: 52,
      backgroundColor: colors.primary,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 24,
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    checkbox: {
      width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
      borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
      marginTop: 1, flexShrink: 0,
    },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    checkmark: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 14 },
    termsText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 19 },
    termsLink: { color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  });
}
