import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useVerifyKyc } from '@/hooks/use-dashboard';
import { useColors } from '@/lib/colors';

export default function KycCallbackScreen() {
  const { status, reference_id } = useLocalSearchParams<{ status?: string; reference_id?: string }>();
  const verify = useVerifyKyc();
  const [state, setState] = useState<'verifying' | 'success' | 'pending' | 'closed' | 'failed'>('verifying');

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    void WebBrowser.dismissBrowser();

    if (status === 'closed') {
      setState('closed');
      setTimeout(() => router.replace('/(tabs)/'), 1500);
      return;
    }
    if (status === 'error') {
      setState('failed');
      setTimeout(() => router.replace('/kyc'), 2500);
      return;
    }
    if (status === 'success' && reference_id) {
      verify.mutate(reference_id, {
        onSuccess: (res) => {
          setState(res.kycStatus === 'VERIFIED' ? 'success' : 'pending');
          setTimeout(() => router.replace('/(tabs)/'), 2500);
        },
        onError: () => {
          setState('pending');
          setTimeout(() => router.replace('/(tabs)/'), 2500);
        },
      });
    } else {
      setState('pending');
      setTimeout(() => router.replace('/(tabs)/'), 2500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      {state === 'verifying' && (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.title}>Verifying your identity…</Text>
          <Text style={styles.sub}>Please wait</Text>
        </>
      )}
      {state === 'success' && (
        <>
          <Text style={styles.icon}>✓</Text>
          <Text style={styles.title}>Identity verified!</Text>
          <Text style={styles.sub}>You can now create and join groups.</Text>
        </>
      )}
      {state === 'pending' && (
        <>
          <Text style={styles.iconPending}>⏳</Text>
          <Text style={styles.title}>Verification in review</Text>
          <Text style={styles.sub}>We'll notify you once your identity is confirmed.</Text>
        </>
      )}
      {state === 'closed' && (
        <>
          <Text style={styles.title}>Verification cancelled</Text>
          <Text style={styles.sub}>You can verify your identity from Settings.</Text>
        </>
      )}
      {state === 'failed' && (
        <>
          <Text style={[styles.icon, styles.iconFail]}>✕</Text>
          <Text style={styles.title}>Verification failed</Text>
          <Text style={styles.sub}>Please try again.</Text>
        </>
      )}
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
      gap: 12,
      padding: 32,
    },
    icon: { fontSize: 56, color: colors.primary },
    iconPending: { fontSize: 52 },
    iconFail: { color: colors.destructive },
    title: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
    sub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  });
}
