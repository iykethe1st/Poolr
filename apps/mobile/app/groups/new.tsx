import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const FREQUENCIES = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Biweekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

export default function NewGroupScreen() {
  const createGroup = useCreateGroup();
  const { data: me } = useCurrentUser();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [maxMembers, setMaxMembers] = useState('');
  const [startDate, setStartDate] = useState('');

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isValid =
    name.trim().length > 0 &&
    Number(amount) >= 100 &&
    Number(maxMembers) >= 3 &&
    Number(maxMembers) <= 50;

  async function handleSubmit() {
    if (!isValid) return;
    if (me?.kycProfile?.kycStatus !== 'VERIFIED') {
      Alert.alert(
        'Identity verification required',
        'You need to verify your identity before creating a group.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Verify now', onPress: () => router.push('/kyc') },
        ],
      );
      return;
    }
    try {
      const group = await createGroup.mutateAsync({
        name: name.trim(),
        contributionAmount: Number(amount),
        frequency,
        maxMembers: Number(maxMembers),
        startDate: startDate.trim() || undefined,
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
  });
}
