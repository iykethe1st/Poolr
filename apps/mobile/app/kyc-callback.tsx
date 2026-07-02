import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useVerifyKyc } from '@/hooks/use-dashboard';
import { useColors } from '@/lib/colors';

export default function KycCallbackScreen() {
  const { status, reference_id } = useLocalSearchParams<{ status?: string; reference_id?: string }>();
  const verify = useVerifyKyc();
  const qc = useQueryClient();
  const [state, setState] = useState<'verifying' | 'success' | 'pending' | 'closed' | 'failed'>('verifying');

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
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
      // Dojah needs a moment to record the Completed status after the SDK dismisses.
      // Retry up to 4 times with 3s gaps before giving up and showing "under review".
      let attempts = 0;
      const MAX_ATTEMPTS = 4;
      const RETRY_DELAY = 3000;

      const attempt = () => {
        attempts += 1;
        verify.mutate(reference_id, {
          onSuccess: (res) => {
            if (res.kycStatus === 'VERIFIED') {
              // Force a fresh fetch of the user profile before navigating
              // so the home screen never shows stale UNDER_REVIEW data.
              void qc.refetchQueries({ queryKey: ['me'] }).then(() => {
                setState('success');
                setTimeout(() => router.replace('/(tabs)/'), 2000);
              });
            } else if (attempts < MAX_ATTEMPTS) {
              setTimeout(attempt, RETRY_DELAY);
            } else {
              setState('pending');
              setTimeout(() => router.replace('/(tabs)/'), 2500);
            }
          },
          onError: () => {
            if (attempts < MAX_ATTEMPTS) {
              setTimeout(attempt, RETRY_DELAY);
            } else {
              setState('pending');
              setTimeout(() => router.replace('/(tabs)/'), 2500);
            }
          },
        });
      };

      attempt();
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
