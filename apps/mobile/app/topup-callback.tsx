import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useVerifyTopUp } from '@/hooks/use-wallet';
import { useColors } from '@/lib/colors';

export default function TopUpCallbackScreen() {
  const { reference } = useLocalSearchParams<{ reference?: string }>();
  const verify = useVerifyTopUp();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!reference) {
      setStatus('failed');
      return;
    }

    verify.mutate(reference, {
      onSuccess: (result) => {
        setStatus(result.status === 'success' ? 'success' : 'failed');
        setTimeout(() => router.replace('/(tabs)/wallet'), 2000);
      },
      onError: () => {
        setStatus('failed');
        setTimeout(() => router.replace('/(tabs)/wallet'), 2000);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  return (
    <View style={styles.root}>
      {status === 'verifying' && (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.title}>Verifying top-up…</Text>
          <Text style={styles.sub}>Please wait</Text>
        </>
      )}
      {status === 'success' && (
        <>
          <Text style={styles.icon}>✓</Text>
          <Text style={styles.title}>Wallet topped up!</Text>
          <Text style={styles.sub}>Redirecting to wallet…</Text>
        </>
      )}
      {status === 'failed' && (
        <>
          <Text style={[styles.icon, styles.iconFail]}>✕</Text>
          <Text style={styles.title}>Top-up could not be verified</Text>
          <Text style={styles.sub}>Redirecting to wallet…</Text>
        </>
      )}
    </View>
  );
}

function createStyles(colors: import('@/lib/colors').Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 12 },
    icon: { fontSize: 56, color: colors.primary },
    iconFail: { color: colors.destructive },
    title: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
    sub: { fontSize: 14, color: colors.textMuted },
  });
}
