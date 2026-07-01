import { useEffect, useRef, useMemo } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/lib/colors';
import { formatCurrency } from '@/lib/format';

export default function PaymentSuccessScreen() {
  const { amount, groupName, groupId, type } = useLocalSearchParams<{
    amount?: string;
    groupName?: string;
    groupId?: string;
    type?: 'contribution' | 'topup' | 'joined' | 'declined' | 'slot-accepted' | 'slot-declined';
  }>();

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 180 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const isDeclined = type === 'declined' || type === 'slot-declined';

  function handleDone() {
    if (type === 'topup') {
      router.replace('/(tabs)/wallet');
    } else if (type === 'declined' || type === 'slot-declined') {
      router.replace('/(tabs)/');
    } else if (groupId) {
      router.replace(`/groups/${groupId}` as never);
    } else {
      router.replace('/(tabs)/');
    }
  }

  const amountNum = amount ? Number(amount) : undefined;

  const title = (() => {
    switch (type) {
      case 'joined': return "You've joined!";
      case 'declined': return 'Invite declined';
      case 'slot-accepted': return 'Extra slot accepted!';
      case 'slot-declined': return 'Slot offer declined';
      case 'topup': return 'Top-up successful!';
      default: return 'Payment successful!';
    }
  })();

  const subtitle = (() => {
    switch (type) {
      case 'joined': return groupName ? `You're now a member of ${groupName}.` : "You're now a member.";
      case 'declined': return groupName ? `You've declined the invite to ${groupName}.` : "Invite declined.";
      case 'slot-accepted': return groupName ? `Your extra slot in ${groupName} is confirmed.` : 'Extra slot confirmed.';
      case 'slot-declined': return 'The slot offer has been declined.';
      case 'topup': return 'Your wallet has been credited.';
      default: return groupName ? `Contribution to ${groupName} confirmed.` : undefined;
    }
  })();

  return (
    <View style={styles.root}>
      <Animated.View style={[
        styles.iconWrap,
        isDeclined && styles.iconWrapNeutral,
        { transform: [{ scale }] },
      ]}>
        <Text style={[styles.icon, isDeclined && styles.iconNeutral]}>
          {isDeclined ? '✕' : '✓'}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.content, { opacity }]}>
        <Text style={styles.title}>{title}</Text>

        {amountNum !== undefined && type !== 'joined' && type !== 'declined' && (
          <Text style={styles.amount}>{formatCurrency(amountNum)}</Text>
        )}

        {subtitle && <Text style={styles.sub}>{subtitle}</Text>}

        <TouchableOpacity style={[styles.btn, isDeclined && styles.btnNeutral]} onPress={handleDone} activeOpacity={0.85}>
          <Text style={styles.btnText}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function createStyles(colors: import('@/lib/colors').Colors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 8,
    },
    iconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: '#dcfce7',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    iconWrapNeutral: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    icon: { fontSize: 44, color: '#16a34a' },
    iconNeutral: { color: colors.textMuted },
    btnNeutral: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    content: { alignItems: 'center', gap: 12, width: '100%' },
    title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
    amount: { fontSize: 32, fontWeight: '800', color: colors.text },
    sub: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
    btn: {
      marginTop: 16,
      width: '100%',
      height: 52,
      backgroundColor: colors.primary,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
}
