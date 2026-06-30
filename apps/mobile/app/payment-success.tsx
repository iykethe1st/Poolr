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
    type?: 'contribution' | 'topup';
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

  function handleDone() {
    if (type === 'topup') {
      router.replace('/(tabs)/wallet');
    } else if (groupId) {
      router.replace(`/groups/${groupId}` as never);
    } else {
      router.replace('/(tabs)/');
    }
  }

  const amountNum = amount ? Number(amount) : undefined;

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.iconWrap, { transform: [{ scale }] }]}>
        <Text style={styles.icon}>✓</Text>
      </Animated.View>

      <Animated.View style={[styles.content, { opacity }]}>
        <Text style={styles.title}>
          {type === 'topup' ? 'Top-up successful!' : 'Payment successful!'}
        </Text>

        {amountNum !== undefined && (
          <Text style={styles.amount}>{formatCurrency(amountNum)}</Text>
        )}

        {groupName && type !== 'topup' && (
          <Text style={styles.sub}>
            Contribution to <Text style={{ fontWeight: '700' }}>{groupName}</Text> confirmed.
          </Text>
        )}

        {type === 'topup' && (
          <Text style={styles.sub}>Your wallet has been credited.</Text>
        )}

        <TouchableOpacity style={styles.btn} onPress={handleDone} activeOpacity={0.85}>
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
    icon: { fontSize: 44, color: '#16a34a' },
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
