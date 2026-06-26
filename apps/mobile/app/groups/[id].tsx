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
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useGroupDetail, useGroupHistory, useInviteMember } from '@/hooks/use-group';
import { useInitializeContribution, useVerifyPayment } from '@/hooks/use-payments';
import { useCurrentUser } from '@/hooks/use-dashboard';
import { useColors } from '@/lib/colors';
import { formatCurrency, formatDate, formatRelativeDate, initials, timeAgo } from '@/lib/format';
import { tierConfig } from '@/lib/tier';
import { StatusBadge } from '@/components/status-badge';
import type { BadgeVariant } from '@/components/status-badge';
import type { Cycle, GroupMember, GroupHistory } from '@/hooks/use-group';

type Tab = 'cycles' | 'members' | 'activity' | 'payouts' | 'penalties';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('cycles');

  const { data: group, isLoading, refetch } = useGroupDetail(id);
  const { data: history, refetch: refetchHistory } = useGroupHistory(id);
  const { data: me } = useCurrentUser();
  const initContrib = useInitializeContribution();
  const verifyPayment = useVerifyPayment();
  const inviteMember = useInviteMember(id);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<'phone' | 'email'>('phone');
  const [inviteValue, setInviteValue] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState<{ message: string; token: string } | null>(null);
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function handlePay(cycleId: string, useWallet = false) {
    try {
      const result = await initContrib.mutateAsync({ cycleId, useWallet });

      if (useWallet || !result.authorizationUrl) {
        Alert.alert('Success', 'Contribution paid from wallet.');
        void refetch();
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
            if (verified.status === 'success') {
              WebBrowser.dismissBrowser();
              Alert.alert('Payment successful', 'Your contribution has been recorded.');
              void refetch();
              void refetchHistory();
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
        'poolr://payment-callback',
      );

      clearTimeout(pollTimer!);

      // Also handle the redirect-based close (deep link worked)
      if (browserResult.type === 'success' && browserResult.url) {
        const url = new URL(browserResult.url);
        const ref = url.searchParams.get('reference') ?? result.reference;
        try {
          const verified = await verifyPayment.mutateAsync(ref);
          if (verified.status === 'success') {
            Alert.alert('Payment successful', 'Your contribution has been recorded.');
            void refetch();
            void refetchHistory();
          } else {
            Alert.alert('Payment pending', 'Payment is being processed. Check back shortly.');
          }
        } catch {
          Alert.alert('Payment pending', 'Payment is being processed. Check back shortly.');
        }
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Payment failed. Please try again.';
      Alert.alert('Error', msg);
    }
  }

  async function handleInvite() {
    if (!inviteValue.trim()) return;
    try {
      const result = await inviteMember.mutateAsync(
        inviteMode === 'phone' ? { phone: inviteValue.trim() } : { email: inviteValue.trim() },
      );
      setInviteSuccess(result);
      setInviteValue('');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to send invite. Please try again.';
      Alert.alert('Error', msg);
    }
  }

  function openInvite() {
    setInviteValue('');
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
  const canInvite = isAdmin && group.status === 'PENDING';
  const activeCycle = group.cycles.find(
    (c) => c.status === 'ACTIVE' || c.status === 'IN_PROGRESS',
  );
  const myContrib = activeCycle?.contributions?.find((c) => c.memberId === myMember?.id);
  const canPay = myMember && activeCycle && (!myContrib || myContrib.status === 'PENDING' || myContrib.status === 'OVERDUE');

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.groupMeta}>
              {group.members.length}/{group.maxMembers} members · {group.frequency.toLowerCase()} · {formatCurrency(group.contributionAmount)}
            </Text>
          </View>
          {canInvite && (
            <TouchableOpacity style={styles.inviteBtn} onPress={openInvite}>
              <Text style={styles.inviteBtnText}>+ Invite</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Pay CTA */}
      {canPay && (
        <View style={styles.payCta}>
          <View>
            <Text style={styles.payCtaTitle}>Cycle {activeCycle!.cycleNumber} contribution due</Text>
            <Text style={styles.payCtaDate}>
              {formatRelativeDate(activeCycle!.dueDate)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <TouchableOpacity
              style={[styles.payBtn, (initContrib.isPending || verifyPayment.isPending) && styles.payBtnDisabled]}
              onPress={() => handlePay(activeCycle!.id)}
              disabled={initContrib.isPending || verifyPayment.isPending}
            >
              {initContrib.isPending || verifyPayment.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.payBtnText}>Pay {formatCurrency(group.contributionAmount)}</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.paystackBadge}>🔒 Secured by Paystack</Text>
          </View>
        </View>
      )}

      {/* Virtual account card */}
      {group.groupAccount && (
        <View style={styles.vaCard}>
          <Text style={styles.vaLabel}>Group bank account</Text>
          <Text style={styles.vaAccount}>{group.groupAccount.accountName}</Text>
          <Text style={styles.vaSub}>{group.groupAccount.bankName} · {group.groupAccount.accountNumber}</Text>
        </View>
      )}

      {/* Invite banner — shown for admin on a PENDING group */}
      {isAdmin && group.status === 'PENDING' && (
        <View style={styles.inviteBanner}>
          <View style={styles.inviteBannerTop}>
            <View>
              <Text style={styles.inviteBannerTitle}>Invite members to start</Text>
              <Text style={styles.inviteBannerSub}>
                {group.members.length} of {group.maxMembers} spots filled
              </Text>
            </View>
            <TouchableOpacity style={styles.inviteBannerBtn} onPress={openInvite} activeOpacity={0.85}>
              <Text style={styles.inviteBannerBtnText}>+ Invite</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inviteProgress}>
            <View
              style={[
                styles.inviteProgressFill,
                { width: `${Math.round((group.members.length / group.maxMembers) * 100)}%` },
              ]}
            />
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['cycles', 'members', 'activity', 'payouts', 'penalties'] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.tabItem, tab === t && styles.tabItemActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'cycles' ? 'Cycles' : t === 'members' ? 'Members' : t === 'activity' ? 'Activity' : t === 'payouts' ? 'Payouts' : 'Penalties'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => { void refetch(); void refetchHistory(); }}
            tintColor={colors.primary}
          />
        }
      >
        {tab === 'cycles' && <CyclesTab cycles={group.cycles} myMemberId={myMember?.id} onPay={handlePay} />}
        {tab === 'members' && <MembersTab members={group.members} history={history} onSelectMember={setSelectedMember} />}
        {tab === 'activity' && <ActivityTab history={history} />}
        {tab === 'payouts' && <PayoutsTab payouts={history?.payouts ?? []} />}
        {tab === 'penalties' && <PenaltiesTab penalties={history?.penalties ?? []} />}
      </ScrollView>

      {/* Invite modal */}
      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdropArea} onPress={() => setInviteOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Invite a member</Text>
          <Text style={styles.sheetSub}>Send an invite to {group.name} via phone or email.</Text>

          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            {(['phone', 'email'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, inviteMode === m && styles.modeBtnActive]}
                onPress={() => { setInviteMode(m); setInviteValue(''); setInviteSuccess(null); }}
              >
                <Text style={[styles.modeBtnText, inviteMode === m && styles.modeBtnTextActive]}>
                  {m === 'phone' ? 'Phone' : 'Email'}
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
              <Pressable style={styles.inviteAnother} onPress={() => { setInviteSuccess(null); setInviteValue(''); }}>
                <Text style={styles.inviteAnotherText}>Invite another</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.inviteInput}
                value={inviteValue}
                onChangeText={setInviteValue}
                placeholder={inviteMode === 'phone' ? '+2348012345678' : 'member@example.com'}
                placeholderTextColor={colors.textMuted}
                keyboardType={inviteMode === 'phone' ? 'phone-pad' : 'email-address'}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={[styles.sheetBtn, (!inviteValue.trim() || inviteMember.isPending) && styles.sheetBtnDisabled]}
                onPress={handleInvite}
                disabled={!inviteValue.trim() || inviteMember.isPending}
              >
                {inviteMember.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.sheetBtnText}>Send invite</Text>
                }
              </Pressable>
            </>
          )}

          <Pressable style={styles.cancelBtn} onPress={() => setInviteOpen(false)}>
            <Text style={styles.cancelBtnText}>Close</Text>
          </Pressable>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Member profile sheet */}
      {selectedMember && (
        <MemberProfileSheet
          member={selectedMember}
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
  onPay,
}: {
  cycles: Cycle[];
  myMemberId?: string;
  onPay: (cycleId: string) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (cycles.length === 0) {
    return <EmptyState text="No cycles have started yet." />;
  }

  const completedCount = cycles.filter((c) => c.status === 'COMPLETED').length;

  return (
    <View style={styles.list}>
      {completedCount > 0 && (
        <View style={styles.cyclesSummary}>
          <Text style={styles.cyclesSummaryText}>
            {completedCount}/{cycles.length} cycles completed
          </Text>
          <View style={styles.cyclesProgressBar}>
            <View style={[styles.cyclesProgressFill, { width: `${Math.round((completedCount / cycles.length) * 100)}%` }]} />
          </View>
        </View>
      )}
      {cycles.map((cycle) => {
        const myContrib = myMemberId
          ? cycle.contributions?.find((c) => c.memberId === myMemberId)
          : undefined;
        const isPaid = myContrib?.status === 'PAID';
        const isActive = cycle.status === 'ACTIVE' || cycle.status === 'IN_PROGRESS';
        const isPending = myContrib?.status === 'PENDING' || myContrib?.status === 'OVERDUE' || (isActive && !myContrib);

        return (
          <View key={cycle.id} style={[styles.cycleCard, isActive && styles.cycleCardActive]}>
            <View style={styles.cycleHeader}>
              <View style={[styles.cycleNumber, isActive && styles.cycleNumberActive]}>
                <Text style={[styles.cycleNumberText, isActive && styles.cycleNumberTextActive]}>
                  {cycle.cycleNumber}
                </Text>
              </View>
              <View style={styles.cycleMeta}>
                <Text style={styles.cycleTitle}>Cycle {cycle.cycleNumber}</Text>
                <Text style={styles.cycleDue}>Due {formatDate(cycle.dueDate)}</Text>
                {cycle.recipientMember && (
                  <Text style={styles.cycleRecipient}>
                    Payout → {cycle.recipientMember.user.fullName}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <CycleBadge status={cycle.status} />
                {isPaid && <Text style={styles.myStatus}>✓ Paid</Text>}
                {isPending && isActive && (
                  <TouchableOpacity
                    style={styles.miniPayBtn}
                    onPress={() => onPay(cycle.id)}
                  >
                    <Text style={styles.miniPayBtnText}>Pay now</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {cycle.contributions && cycle.contributions.length > 0 && (
              <View style={styles.contribProgress}>
                <Text style={styles.contribProgressText}>
                  {cycle.contributions.filter((c) => c.status === 'PAID').length}/
                  {cycle.contributions.length} paid
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${(cycle.contributions.filter((c) => c.status === 'PAID').length / cycle.contributions.length) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function CycleBadge({ status }: { status: string }) {
  const variantMap: Record<string, { variant: BadgeVariant; label: string }> = {
    ACTIVE:      { variant: 'success',   label: 'Active' },
    IN_PROGRESS: { variant: 'info',      label: 'In Progress' },
    COMPLETED:   { variant: 'completed', label: 'Completed' },
    PENDING:     { variant: 'warning',   label: 'Pending' },
    SKIPPED:     { variant: 'neutral',   label: 'Skipped' },
  };
  const { variant, label } = variantMap[status] ?? { variant: 'neutral' as BadgeVariant, label: status };
  return <StatusBadge label={label} variant={variant} />;
}

function MembersTab({
  members,
  history,
  onSelectMember,
}: {
  members: GroupMember[];
  history: GroupHistory | undefined;
  onSelectMember: (m: GroupMember) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (members.length === 0) {
    return <EmptyState text="No members yet." />;
  }
  return (
    <View style={styles.list}>
      {members.map((m) => {
        const isVerified = m.user.kycProfile?.kycStatus === 'VERIFIED';
        return (
          <TouchableOpacity
            key={m.id}
            style={styles.memberRow}
            onPress={() => onSelectMember(m)}
            activeOpacity={0.7}
          >
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>{initials(m.user.fullName)}</Text>
            </View>
            <View style={styles.memberInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.memberName}>{m.user.fullName}</Text>
                {isVerified && (
                  <StatusBadge label="✓ KYC" variant="success" />
                )}
              </View>
              <Text style={styles.memberEmail}>{m.user.email}</Text>
            </View>
            <StatusBadge
              label={m.memberStatus === 'ACTIVE' ? 'Active' : 'Invited'}
              variant={m.memberStatus === 'ACTIVE' ? 'success' : 'warning'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MemberProfileSheet({
  member,
  history,
  onClose,
}: {
  member: GroupMember;
  history: GroupHistory | undefined;
  onClose: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const contribs = history?.contributions.filter((c) => c.memberId === member.id) ?? [];
  const paid = contribs.filter((c) => c.status === 'PAID');
  const onTimePaid = paid.filter((c) => c.paidAt && c.dueAt && new Date(c.paidAt) <= new Date(c.dueAt));
  const onTimeRate = paid.length > 0 ? Math.round((onTimePaid.length / paid.length) * 100) : null;
  const penalties = history?.penalties.filter((p) => p.memberId === member.id && p.status === 'APPLIED') ?? [];

  const isVerified = member.user.kycProfile?.kycStatus === 'VERIFIED';
  const tc = member.tier && member.tier !== 'NEW' ? tierConfig(member.tier) : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdropArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          {/* Avatar + name + badges */}
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatarLg}>
              <Text style={styles.profileAvatarLgText}>{initials(member.user.fullName)}</Text>
            </View>
            <Text style={styles.profileNameLg}>{member.user.fullName}</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {isVerified ? (
                <StatusBadge label="✓ Verified" variant="success" />
              ) : (
                <StatusBadge label="Unverified" variant="danger" />
              )}
              {tc && (
                <View style={[styles.tierBadge, { backgroundColor: tc.bg, paddingHorizontal: 8, paddingVertical: 3 }]}>
                  <Text style={[styles.tierBadgeText, { color: tc.color, fontSize: 12 }]}>
                    {tc.emoji} {tc.label}
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
                <Text style={styles.profileRowIcon}>📞</Text>
                <Text style={styles.profileRowText}>{member.user.phone}</Text>
              </View>
            )}
            <View style={styles.profileRow}>
              <Text style={styles.profileRowIcon}>✉️</Text>
              <Text style={styles.profileRowText}>{member.user.email}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileRowIcon}>📅</Text>
              <Text style={styles.profileRowText}>Joined {formatDate(member.joinedAt)}</Text>
            </View>
          </View>

          {/* Reliability */}
          <View style={styles.profileSection}>
            <Text style={styles.profileSectionTitle}>Reliability</Text>
            {contribs.length === 0 ? (
              <Text style={[styles.profileRowText, { color: colors.textMuted, paddingLeft: 4 }]}>No contributions yet</Text>
            ) : (
              <>
                <View style={styles.profileRow}>
                  <Text style={styles.profileRowIcon}>💳</Text>
                  <Text style={styles.profileRowText}>{paid.length} contribution{paid.length !== 1 ? 's' : ''} paid</Text>
                </View>
                {onTimeRate !== null && (
                  <View style={styles.profileRow}>
                    <Text style={styles.profileRowIcon}>⏱</Text>
                    <Text style={[styles.profileRowText, {
                      color: onTimeRate === 100 ? '#166534' : onTimeRate >= 75 ? '#854d0e' : '#b91c1c',
                      fontWeight: '600',
                    }]}>
                      {onTimeRate}% on time
                    </Text>
                  </View>
                )}
                {penalties.length > 0 && (
                  <View style={styles.profileRow}>
                    <Text style={styles.profileRowIcon}>⚠️</Text>
                    <Text style={[styles.profileRowText, { color: '#b91c1c' }]}>
                      {penalties.length} penalt{penalties.length !== 1 ? 'ies' : 'y'}
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

function ActivityTab({ history }: { history: GroupHistory | undefined }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const contribs = history?.contributions ?? [];
  const payouts = history?.payouts ?? [];

  type ActivityItem = { id: string; isCredit: boolean; desc: string; amount: string; date: string };
  const items: ActivityItem[] = [
    ...contribs.map((c) => ({
      id: c.id,
      isCredit: false,
      desc: `${c.member.user.fullName} — Cycle ${c.cycle.cycleNumber}`,
      amount: c.amount,
      date: c.createdAt,
    })),
    ...payouts.map((p) => ({
      id: p.id,
      isCredit: true,
      desc: `Payout to ${p.recipient.fullName} — Cycle ${p.cycle.cycleNumber}`,
      amount: p.amount,
      date: p.createdAt,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (items.length === 0) {
    return <EmptyState text="No activity yet." />;
  }
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item.id} style={styles.activityRow}>
          <View style={[styles.activityIcon, item.isCredit ? styles.activityIconCredit : styles.activityIconDebit]}>
            <Text style={{ fontSize: 14 }}>{item.isCredit ? '↓' : '↑'}</Text>
          </View>
          <View style={styles.activityInfo}>
            <Text style={styles.activityDesc} numberOfLines={2}>{item.desc}</Text>
            <Text style={styles.activityDate}>{timeAgo(item.date)}</Text>
          </View>
          <Text style={[styles.activityAmount, item.isCredit ? styles.credit : styles.debit]}>
            {item.isCredit ? '+' : '-'}{formatCurrency(item.amount)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PayoutsTab({ payouts }: { payouts: GroupHistory['payouts'] }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (payouts.length === 0) {
    return <EmptyState text="No payouts yet." />;
  }
  const PAYOUT_VARIANT: Record<string, { variant: BadgeVariant; label: string }> = {
    PENDING:   { variant: 'warning',   label: 'Pending' },
    INITIATED: { variant: 'info',      label: 'Initiated' },
    COMPLETED: { variant: 'success',   label: 'Completed' },
    FAILED:    { variant: 'danger',    label: 'Failed' },
  };
  return (
    <View style={styles.list}>
      {payouts.map((p) => {
        const cfg = PAYOUT_VARIANT[p.status] ?? PAYOUT_VARIANT.PENDING;
        return (
          <View key={p.id} style={styles.payoutRow}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.payoutRecipient}>{p.recipient.fullName}</Text>
              <Text style={styles.payoutMeta}>Cycle {p.cycle.cycleNumber} · {timeAgo(p.createdAt)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[styles.activityAmount, styles.credit]}>{formatCurrency(p.amount)}</Text>
              <StatusBadge label={cfg.label} variant={cfg.variant} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PenaltiesTab({ penalties }: { penalties: GroupHistory['penalties'] }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (penalties.length === 0) {
    return <EmptyState text="No penalties recorded." />;
  }
  const PENALTY_VARIANT: Record<string, { variant: BadgeVariant; label: string }> = {
    PENDING: { variant: 'warning', label: 'Pending' },
    APPLIED: { variant: 'danger',  label: 'Applied' },
    WAIVED:  { variant: 'neutral', label: 'Waived' },
  };
  return (
    <View style={styles.list}>
      {penalties.map((p) => {
        const cfg = PENALTY_VARIANT[p.status] ?? PENALTY_VARIANT.PENDING;
        return (
          <View key={p.id} style={styles.payoutRow}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.payoutRecipient}>{p.member.user.fullName}</Text>
              <Text style={styles.payoutMeta}>{p.reason} · Cycle {p.contribution.cycle.cycleNumber}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[styles.activityAmount, styles.debit]}>{formatCurrency(p.penaltyAmount)}</Text>
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

function createStyles(colors: import('@/lib/colors').Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    loadingRoot: { flex: 1, backgroundColor: colors.background, padding: 16, paddingTop: 56 },
    header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    back: { marginBottom: 8 },
    backText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerInfo: { flex: 1, gap: 3 },
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
    inviteBannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    inviteBannerTitle: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
    inviteBannerSub: { fontSize: 12, color: colors.primaryTextMid, marginTop: 2 },
    inviteBannerBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 10,
    },
    inviteBannerBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    inviteProgress: {
      height: 6,
      backgroundColor: colors.primaryBorder,
      borderRadius: 3,
      overflow: 'hidden',
    },
    inviteProgressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    inviteBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary },
    inviteBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    groupName: { fontSize: 22, fontWeight: '600', color: colors.text },
    groupMeta: { fontSize: 13, color: colors.textMuted },

    payCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primaryBg,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.primaryBorder,
    },
    payCtaTitle: { fontSize: 13, fontWeight: '700', color: colors.primaryText },
    payCtaDate: { fontSize: 12, color: colors.primaryTextMid, marginTop: 1 },
    payBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    payBtnDisabled: { opacity: 0.6 },
    payBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    paystackBadge: { fontSize: 10, color: colors.primaryTextMid, fontWeight: '500' },

    vaCard: {
      backgroundColor: colors.primaryBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.primaryBorder,
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 2,
    },
    vaLabel: { fontSize: 11, color: colors.primaryTextMid, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    vaAccount: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
    vaSub: { fontSize: 12, color: colors.primaryTextMid },

    tabs: { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center' },
    tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
    tabTextActive: { color: colors.primary },

    scrollView: { flex: 1 },
    scrollContent: { padding: 16, gap: 10 },
    list: { gap: 10 },

    cycleCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    cycleCardActive: { borderColor: colors.primary + '60', backgroundColor: colors.primaryBg },
    cycleHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    cycleNumber: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cycleNumberActive: { backgroundColor: colors.primary },
    cycleNumberText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
    cycleNumberTextActive: { color: '#fff' },
    cycleMeta: { flex: 1, gap: 2 },
    cycleTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    cycleDue: { fontSize: 12, color: colors.textMuted },
    cycleRecipient: { fontSize: 12, color: colors.primary, fontWeight: '600' },
    myStatus: { fontSize: 11, color: colors.successText, fontWeight: '700' },
    miniPayBtn: { backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 7 },
    miniPayBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

    contribProgress: { gap: 5 },
    contribProgressText: { fontSize: 11, color: colors.textMuted },
    progressBar: { height: 4, backgroundColor: colors.border, borderRadius: 99 },
    progressFill: { height: 4, backgroundColor: colors.primary, borderRadius: 99 },

    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
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
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    memberAvatarText: { fontSize: 14, fontWeight: '700', color: colors.primary },
    memberInfo: { flex: 1, gap: 2 },
    memberName: { fontSize: 14, fontWeight: '600', color: colors.text },
    memberEmail: { fontSize: 12, color: colors.textMuted },
    tierBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99 },
    tierBadgeText: { fontSize: 10, fontWeight: '700' },

    profileHeader: { alignItems: 'center', gap: 8, paddingBottom: 4 },
    profileAvatarLg: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: colors.successBg,
      alignItems: 'center', justifyContent: 'center',
    },
    profileAvatarLgText: { fontSize: 24, fontWeight: '700', color: colors.primary },
    profileNameLg: { fontSize: 20, fontWeight: '700', color: colors.text },
    profileSection: { gap: 8 },
    profileSectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    profileRowIcon: { fontSize: 15, width: 22, textAlign: 'center' },
    profileRowText: { fontSize: 14, color: colors.text, flex: 1 },
    cyclesSummary: { backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 8 },
    cyclesSummaryText: { fontSize: 13, fontWeight: '600', color: colors.text },
    cyclesProgressBar: { height: 5, backgroundColor: colors.border, borderRadius: 99 },
    cyclesProgressFill: { height: 5, backgroundColor: colors.primary, borderRadius: 99 },


    activityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    activityIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    activityIconCredit: { backgroundColor: colors.successBg },
    activityIconDebit: { backgroundColor: colors.dangerBg },
    activityInfo: { flex: 1, gap: 2 },
    activityDesc: { fontSize: 13, fontWeight: '600', color: colors.text },
    activityDate: { fontSize: 12, color: colors.textMuted },
    activityAmount: { fontSize: 14, fontWeight: '700' },
    credit: { color: colors.successText },
    debit: { color: colors.dangerText },

    payoutRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    payoutRecipient: { fontSize: 14, fontWeight: '600', color: colors.text },
    payoutMeta: { fontSize: 12, color: colors.textMuted },

    emptyState: { paddingVertical: 40, alignItems: 'center' },
    emptyStateText: { fontSize: 14, color: colors.textMuted },

    modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    backdropArea: { flex: 1 },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 32 : 24,
      paddingTop: 12,
      gap: 14,
    },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 4 },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    sheetSub: { fontSize: 14, color: colors.textMuted, marginTop: -8 },
    modeToggle: { flexDirection: 'row', gap: 8, padding: 4, backgroundColor: colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
    modeBtnActive: { backgroundColor: colors.primary },
    modeBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
    modeBtnTextActive: { color: '#fff' },
    inviteInput: {
      height: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.inputBg,
    },
    sheetBtn: { height: 48, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    sheetBtnDisabled: { opacity: 0.5 },
    sheetBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    cancelBtn: { alignItems: 'center', paddingVertical: 4 },
    cancelBtnText: { fontSize: 14, color: colors.textMuted },
    successBox: { gap: 12 },
    successMsg: { fontSize: 14, fontWeight: '700', color: colors.successText },
    successHint: { fontSize: 13, color: colors.textMuted },
    shareBtn: { height: 44, backgroundColor: colors.primaryBg, borderRadius: 10, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
    shareBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
    inviteAnother: { alignItems: 'center', paddingVertical: 4 },
    inviteAnotherText: { fontSize: 13, color: colors.textMuted, textDecorationLine: 'underline' },
  });
}
