import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useCurrentUser, useMyContributions, useMyGroups } from '@/hooks/use-dashboard';
import { useNextPayout } from '@/hooks/use-payments';
import { useWallet } from '@/hooks/use-wallet';
import { useColors } from '@/lib/colors';
import { formatCurrency, formatRelativeDate } from '@/lib/format';
import { StatusBadge } from '@/components/status-badge';

export default function HomeScreen() {
  const { data: me, isLoading: meLoading, refetch: refetchMe } = useCurrentUser();
  const { data: wallet, refetch: refetchWallet } = useWallet();
  const { data: groups = [], isLoading: groupsLoading, refetch: refetchGroups } = useMyGroups();
  const { data: contributions = [], isLoading: contribLoading, refetch: refetchContribs } = useMyContributions();
  const { data: nextPayout, refetch: refetchPayout } = useNextPayout();

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isRefreshing = meLoading || groupsLoading || contribLoading;

  function onRefresh() {
    void Promise.all([refetchMe(), refetchWallet(), refetchGroups(), refetchContribs(), refetchPayout()]);
  }

  const pendingContribs = contributions.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE');
  const activeGroups = groups.filter((g) => g.status === 'ACTIVE');
  const balance = parseFloat(wallet?.balance ?? '0');

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hello, {me?.fullName?.split(' ')[0] ?? '—'} 👋
          </Text>
          <Text style={styles.greetingSub}>Here's your savings overview</Text>
        </View>
      </View>

      {/* KYC banner */}
      {me && me.kycProfile?.kycStatus !== 'VERIFIED' && (
        <TouchableOpacity
          style={[
            styles.kycBanner,
            me.kycProfile?.kycStatus === 'PENDING' || me.kycProfile?.kycStatus === 'UNDER_REVIEW'
              ? styles.kycBannerPending
              : styles.kycBannerUnverified,
          ]}
          onPress={() => router.push('/kyc')}
          activeOpacity={0.85}
        >
          <View style={styles.kycBannerLeft}>
            <Text style={styles.kycBannerIcon}>
              {me.kycProfile?.kycStatus === 'PENDING' || me.kycProfile?.kycStatus === 'UNDER_REVIEW' ? '⏳' : '🪪'}
            </Text>
            <View>
              <Text style={styles.kycBannerTitle}>
                {me.kycProfile?.kycStatus === 'PENDING' || me.kycProfile?.kycStatus === 'UNDER_REVIEW'
                  ? 'Verification in review'
                  : 'Verify your identity'}
              </Text>
              <Text style={styles.kycBannerSub}>
                {me.kycProfile?.kycStatus === 'PENDING' || me.kycProfile?.kycStatus === 'UNDER_REVIEW'
                  ? "We'll notify you when approved"
                  : 'Required to create or join groups'}
              </Text>
            </View>
          </View>
          {me.kycProfile?.kycStatus !== 'PENDING' && me.kycProfile?.kycStatus !== 'UNDER_REVIEW' && (
            <Text style={styles.kycBannerArrow}>›</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Wallet balance card */}
      <TouchableOpacity
        style={styles.balanceCard}
        onPress={() => router.push('/(tabs)/wallet')}
        activeOpacity={0.85}
      >
        <Text style={styles.balanceLabel}>Wallet balance</Text>
        <Text style={styles.balanceAmount}>{formatCurrency(balance)}</Text>
        <Text style={styles.balanceSub}>Tap to manage wallet</Text>
      </TouchableOpacity>

      {/* Next payout */}
      {nextPayout && (
        <View style={styles.section}>
          <View style={styles.payoutCard}>
            <Text style={styles.payoutLabel}>Your next payout</Text>
            <Text style={styles.payoutAmount}>{formatCurrency(nextPayout.amount)}</Text>
            <Text style={styles.payoutFrom}>{nextPayout.groupName}</Text>
            {nextPayout.estimatedDate && (
              <Text style={styles.payoutDate}>
                Est. {formatRelativeDate(nextPayout.estimatedDate)}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Pending contributions */}
      {pendingContribs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming contributions</Text>
          {pendingContribs.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.contribRow,
                c.status === 'OVERDUE' && styles.contribOverdue,
              ]}
              onPress={() => router.push(`/groups/${c.cycle.group.id}`)}
              activeOpacity={0.75}
            >
              <View style={styles.contribLeft}>
                <Text style={styles.contribName}>{c.cycle.group.name}</Text>
                <Text style={styles.contribMeta}>
                  Cycle {c.cycle.cycleNumber} · Due {formatRelativeDate(c.cycle.dueDate)}
                </Text>
              </View>
              <View style={styles.contribRight}>
                <Text style={styles.contribAmount}>{formatCurrency(c.amount)}</Text>
                <StatusBadge
                  label={c.status === 'OVERDUE' ? 'Overdue' : 'Due'}
                  variant={c.status === 'OVERDUE' ? 'danger' : 'warning'}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Empty state — no groups at all */}
      {groups.length === 0 && !groupsLoading && (
        <View style={styles.getStarted}>
          <Text style={styles.getStartedEmoji}>💰</Text>
          <Text style={styles.getStartedTitle}>Start saving together</Text>
          <Text style={styles.getStartedBody}>
            Create your own savings circle or join one from a friend. Everyone contributes, everyone benefits.
          </Text>
          <TouchableOpacity
            style={styles.getStartedPrimary}
            onPress={() => router.push('/groups/new')}
            activeOpacity={0.85}
          >
            <Text style={styles.getStartedPrimaryText}>Create a group</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.getStartedSecondary}
            onPress={() => router.push('/(tabs)/groups')}
            activeOpacity={0.85}
          >
            <Text style={styles.getStartedSecondaryText}>Join a group</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Active groups */}
      {groups.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active groups</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/groups')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {activeGroups.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No active groups yet — your pending groups will appear here once they start.</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/groups')}>
                <Text style={styles.emptyLink}>View all groups</Text>
              </TouchableOpacity>
            </View>
          ) : (
            activeGroups.slice(0, 3).map((g) => (
              <TouchableOpacity
                key={g.id}
                style={styles.groupCard}
                onPress={() => router.push(`/groups/${g.id}`)}
                activeOpacity={0.75}
              >
                <View style={styles.groupLeft}>
                  <View style={styles.groupAvatar}>
                    <Text style={styles.groupAvatarText}>{g.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.groupName}>{g.name}</Text>
                    <Text style={styles.groupMeta}>
                      {g._count?.members ?? 0} members · {g.frequency}
                    </Text>
                  </View>
                </View>
                <Text style={styles.groupAmount}>{formatCurrency(g.contributionAmount)}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(colors: import('@/lib/colors').Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingTop: 56, gap: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    greeting: { fontSize: 22, fontWeight: '700', color: colors.text },
    greetingSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

    balanceCard: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      padding: 24,
      gap: 4,
    },
    balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
    balanceAmount: { fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -1 },
    balanceSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

    payoutCard: {
      backgroundColor: colors.primaryBg,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    payoutLabel: { fontSize: 12, color: colors.primaryText, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    payoutAmount: { fontSize: 24, fontWeight: '800', color: colors.primaryText, marginTop: 4 },
    payoutFrom: { fontSize: 13, color: colors.primaryTextMid, marginTop: 2 },
    payoutDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },

    section: { gap: 10 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    seeAll: { fontSize: 13, color: colors.primary, fontWeight: '600' },

    contribRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    contribOverdue: { borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg },
    contribLeft: { gap: 3 },
    contribName: { fontSize: 14, fontWeight: '600', color: colors.text },
    contribMeta: { fontSize: 12, color: colors.textMuted },
    contribRight: { alignItems: 'flex-end', gap: 4 },
    contribAmount: { fontSize: 14, fontWeight: '700', color: colors.text },

    groupCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    groupLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    groupAvatar: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.successBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupAvatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
    groupName: { fontSize: 14, fontWeight: '600', color: colors.text },
    groupMeta: { fontSize: 12, color: colors.textMuted },
    groupAmount: { fontSize: 14, fontWeight: '700', color: colors.primary },

    empty: { backgroundColor: colors.card, borderRadius: 14, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
    emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
    emptyLink: { fontSize: 14, color: colors.primary, fontWeight: '600' },

    getStarted: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 28,
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    getStartedEmoji: { fontSize: 52, marginBottom: 4 },
    getStartedTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
    getStartedBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
    getStartedPrimary: {
      width: '100%',
      marginTop: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
    },
    getStartedPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    getStartedSecondary: {
      width: '100%',
      backgroundColor: colors.primaryBg,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    getStartedSecondaryText: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },

    kycBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
    },
    kycBannerUnverified: {
      backgroundColor: colors.warningBg,
      borderColor: colors.warning + '50',
    },
    kycBannerPending: {
      backgroundColor: colors.infoBg,
      borderColor: colors.infoText + '30',
    },
    kycBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    kycBannerIcon: { fontSize: 28 },
    kycBannerTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    kycBannerSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    kycBannerArrow: { fontSize: 22, color: colors.textMuted },
  });
}
