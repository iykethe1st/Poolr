import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Tier = 'New' | 'Trusted' | 'Reliable' | 'Elite';

const TIER_STYLE: Record<Tier, { bg: string; text: string; emoji: string }> = {
  New:      { bg: '#f1f5f9', text: '#64748b', emoji: '○' },
  Trusted:  { bg: '#fef3c7', text: '#92400e', emoji: '⭐' },
  Reliable: { bg: '#dbeafe', text: '#1d4ed8', emoji: '🌟' },
  Elite:    { bg: '#fef9c3', text: '#78350f', emoji: '👑' },
};

interface TrustScoreBadgeProps {
  tier: string;
  userStatus?: string;
}

export function TrustScoreBadge({ tier, userStatus }: TrustScoreBadgeProps) {
  // Live account status takes visual precedence
  if (userStatus === 'FROZEN') {
    return (
      <View style={[styles.badge, { backgroundColor: '#dbeafe' }]}>
        <Text style={[styles.label, { color: '#1d4ed8' }]}>🧊 Frozen</Text>
      </View>
    );
  }
  if (userStatus === 'BANNED') {
    return (
      <View style={[styles.badge, { backgroundColor: '#fee2e2' }]}>
        <Text style={[styles.label, { color: '#dc2626' }]}>🚫 Banned</Text>
      </View>
    );
  }

  const normalised = (tier?.charAt(0).toUpperCase() + tier?.slice(1).toLowerCase()) as Tier;
  const style = TIER_STYLE[normalised] ?? TIER_STYLE.New;

  if (normalised === 'New') return null;

  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.label, { color: style.text }]}>
        {style.emoji} {normalised}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
  },
});
