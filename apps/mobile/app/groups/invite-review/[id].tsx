import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useGroupDetail, useAcceptInvite, useDeclineInvite } from '@/hooks/use-group';
import { useCurrentUser } from '@/hooks/use-dashboard';
import { useColors } from '@/lib/colors';
import { formatCurrency } from '@/lib/format';
import { KycRequiredModal } from '@/components/kyc-required-modal';

function formatFreq(f: string) {
  return { WEEKLY: 'Weekly', BIWEEKLY: 'Bi-weekly', MONTHLY: 'Monthly' }[f] ?? f;
}

const TERMS_SECTIONS = [
  { title: '1. Contribution Commitment', body: 'By joining this group you commit to making your full contribution every cycle for the entire duration of the group. Missing a contribution affects every other member and may result in penalties.' },
  { title: '2. Payout Schedule', body: 'Payouts are distributed to members in the agreed rotation order. Each member receives the full pooled amount exactly once. The payout order cannot be changed after the group starts.' },
  { title: '3. Default & Loss Sharing', body: 'If a member receives their payout and subsequently stops contributing, the shortfall is shared equally among all remaining active members. Poolr cannot recover funds from defaulting members. You accept this risk by joining.' },
  { title: '4. Default Protection Fund', body: 'Poolr holds a Default Protection Fund funded by a portion of platform fees. This fund may partially offset verified defaults at Poolr\'s discretion. It does not guarantee full recovery of losses.' },
  { title: '5. Late Payment Penalties', body: 'Contributions not received by the due date may incur a late penalty of 5% of the contribution amount where the group admin has enabled penalties.' },
  { title: '6. Platform Fee', body: 'A platform fee is charged on every contribution you make. This fee is added to your contribution and is non-refundable. The exact amount is displayed before you confirm each payment.' },
  { title: '7. No Early Withdrawal', body: 'Once a group has started, contributions cannot be refunded or withdrawn. You are committed for the full duration.' },
  { title: '8. Your Responsibility', body: 'You are solely responsible for ensuring your payment method has sufficient funds on each due date. Insufficient funds do not excuse a missed contribution.' },
];

export default function InviteReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: group, isLoading, isError } = useGroupDetail(id);
  const { data: me } = useCurrentUser();
  const accept = useAcceptInvite(id);
  const decline = useDeclineInvite(id);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const busy = accept.isPending || decline.isPending;
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [kycModalOpen, setKycModalOpen] = useState(false);

  function handleAccept() {
    if (me?.kycProfile?.kycStatus !== 'VERIFIED') {
      setKycModalOpen(true);
      return;
    }

    accept.mutate(undefined, {
      onSuccess: () => {
        router.replace(`/groups/${id}`);
      },
      onError: () => {
        Alert.alert('Error', 'Failed to accept invite. Please try again.');
      },
    });
  }

  function handleDecline() {
    Alert.alert(
      'Decline invite',
      `Are you sure you want to decline the invite to "${group?.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () =>
            decline.mutate(undefined, {
              onSuccess: () => router.back(),
              onError: () => Alert.alert('Error', 'Failed to decline invite. Please try again.'),
            }),
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !group) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Invite not found</Text>
        <Text style={styles.errorText}>
          This invite link may be invalid or expired.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const memberCount = group._count?.members ?? group.members.length;
  const penaltyEnabled = !!group.penaltyConfig;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Header */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>You've been invited</Text>
      <Text style={styles.subheading}>Review the group details before you accept.</Text>

      {/* Group card */}
      <View style={styles.card}>
        <View style={styles.cardIconRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{group.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.groupStatus}>{group.status.toLowerCase()}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailsGrid}>
          <DetailRow label="Contribution" value={formatCurrency(group.contributionAmount)} />
          <DetailRow label="Frequency" value={formatFreq(group.frequency)} />
          <DetailRow label="Members" value={`${memberCount} / ${group.maxMembers}`} />
          {group.startDate && (
            <DetailRow
              label="Start date"
              value={new Date(group.startDate).toLocaleDateString('en-NG', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            />
          )}
          <DetailRow label="Late penalties" value={penaltyEnabled ? 'Yes — 5%' : 'No'} />
        </View>
      </View>

      {/* Risk warning */}
      <View style={styles.warning}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text style={styles.warningText}>
          By joining, you commit to contributing every cycle for the full duration.{' '}
          <Text style={{ fontWeight: '700' }}>
            Any losses from members who default are shared by the entire group, including you.
          </Text>
        </Text>
      </View>

      {/* Terms acceptance */}
      <TouchableOpacity
        style={styles.termsRow}
        onPress={() => setTermsAccepted((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
          {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.termsText}>
          I agree to the{' '}
          <Text style={styles.termsLink} onPress={() => setTermsModalOpen(true)}>
            Group Savings Circle Terms
          </Text>
          , including the default risk and payout schedule.
        </Text>
      </TouchableOpacity>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.acceptBtn, (busy || !termsAccepted) && styles.btnDisabled]}
          onPress={handleAccept}
          disabled={busy || !termsAccepted}
        >
          {accept.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.acceptBtnText}>Accept invite</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.declineBtn, busy && styles.btnDisabled]}
          onPress={handleDecline}
          disabled={busy}
        >
          {decline.isPending ? (
            <ActivityIndicator color={colors.textMuted} size="small" />
          ) : (
            <Text style={styles.declineBtnText}>Decline</Text>
          )}
        </TouchableOpacity>
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
        context="join"
        redirectPath={`/groups/invite-review/${id}`}
      />
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text style={{ fontSize: 14, color: colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{value}</Text>
    </View>
  );
}

function createStyles(colors: import('@/lib/colors').Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    backRow: { marginBottom: 20 },
    backText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
    heading: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 6 },
    subheading: { fontSize: 14, color: colors.textMuted, marginBottom: 24 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    cardIconRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 22, fontWeight: '700', color: colors.primary },
    groupName: { fontSize: 17, fontWeight: '700', color: colors.text },
    groupStatus: { fontSize: 12, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
    divider: { height: 1, backgroundColor: colors.border, marginBottom: 4 },
    detailsGrid: { gap: 0 },
    warning: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: colors.warningBg ?? 'rgba(245,158,11,0.1)',
      borderRadius: 14,
      padding: 14,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.warningBorder ?? 'rgba(245,158,11,0.25)',
    },
    warningIcon: { fontSize: 16, marginTop: 1 },
    warningText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },
    actions: { gap: 10 },
    acceptBtn: {
      height: 52,
      backgroundColor: colors.primary,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    declineBtn: {
      height: 52,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    declineBtnText: { fontSize: 15, color: colors.textMuted, fontWeight: '600' },
    btnDisabled: { opacity: 0.55 },
    termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
    checkbox: {
      width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
      borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
      marginTop: 1, flexShrink: 0,
    },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    checkmark: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 14 },
    termsText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 19 },
    termsLink: { color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
    errorTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    errorText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
    backBtn: {
      marginTop: 8,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backBtnText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  });
}
