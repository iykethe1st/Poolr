import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCurrentUser } from '@/hooks/use-dashboard';
import { useVerifyKyc } from '@/hooks/use-dashboard';
import { useColors } from '@/lib/colors';
import { API_BASE_URL } from '@/api/client';
import { StatusBar } from 'expo-status-bar';

const STEPS = [
  { icon: '🪪', label: 'Government-issued ID', desc: "National ID, passport, or driver's licence" },
  { icon: '🤳', label: 'Selfie check', desc: 'A quick photo to match your ID' },
  { icon: '⏱️', label: 'Takes ~2 minutes', desc: 'Instant result in most cases' },
];

export default function KycScreen() {
  const { data: me, isLoading } = useCurrentUser();
  const verifyKyc = useVerifyKyc();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [busy, setBusy] = useState(false);

  const kycStatus = me?.kycProfile?.kycStatus ?? 'UNVERIFIED';
  const isVerified = kycStatus === 'VERIFIED';
  const isPending = kycStatus === 'PENDING' || kycStatus === 'UNDER_REVIEW';

  async function handleStart() {
    if (!me?.id) return;
    setBusy(true);
    try {
      const widgetUrl = `${API_BASE_URL}/users/kyc/widget?user_id=${encodeURIComponent(me.id)}`;
      const result = await WebBrowser.openAuthSessionAsync(widgetUrl, 'poolr://kyc-callback');

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const status = url.searchParams.get('status');
        const referenceId = url.searchParams.get('reference_id') ?? '';

        if (status === 'success' && referenceId) {
          await verifyKyc.mutateAsync(referenceId);
        } else if (status === 'error') {
          Alert.alert(
            'Verification failed',
            'Something went wrong with the identity check. Please try again.',
          );
        }
        // 'closed' means user cancelled — no alert needed
      } else if (result.type === 'cancel') {
        // dismissed by user — no alert
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open the verification flow. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <StatusBar style="auto" />

      {/* Back */}
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Verify your identity</Text>
      <Text style={styles.subtitle}>
        Poolr is required to verify your identity before you can create or join a savings group.
        Your information is encrypted and never shared.
      </Text>

      {/* Status banner */}
      {isVerified && (
        <View style={[styles.statusBanner, styles.statusVerified]}>
          <Text style={styles.statusText}>✓ Your identity has been verified</Text>
        </View>
      )}
      {isPending && (
        <View style={[styles.statusBanner, styles.statusPending]}>
          <Text style={[styles.statusText, { color: colors.warningText }]}>
            ⏳ Verification is in review — we'll notify you when it's complete
          </Text>
        </View>
      )}

      {/* What you'll need */}
      <View style={styles.stepsCard}>
        <Text style={styles.stepsTitle}>What you'll need</Text>
        {STEPS.map((s) => (
          <View key={s.label} style={styles.stepRow}>
            <Text style={styles.stepIcon}>{s.icon}</Text>
            <View style={styles.stepText}>
              <Text style={styles.stepLabel}>{s.label}</Text>
              <Text style={styles.stepDesc}>{s.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {!isVerified && !isPending && (
        <TouchableOpacity
          style={[styles.startBtn, busy && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.startBtnText}>Start Verification</Text>
          )}
        </TouchableOpacity>
      )}

      {isPending && (
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Back to app</Text>
        </TouchableOpacity>
      )}

      {isVerified && (
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Back</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.legal}>
        Powered by Dojah · Your data is processed securely and never sold to third parties.
      </Text>
    </ScrollView>
  );
}

function createStyles(colors: import('@/lib/colors').Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingTop: 60, paddingBottom: 40, gap: 16 },

    back: { marginBottom: 8 },
    backText: { fontSize: 15, color: colors.primary, fontWeight: '600' },

    title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
    subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 22 },

    statusBanner: {
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
    },
    statusVerified: {
      backgroundColor: colors.successBg,
      borderColor: colors.primary + '40',
    },
    statusPending: {
      backgroundColor: colors.warningBg,
      borderColor: colors.warning + '40',
    },
    statusText: { fontSize: 14, fontWeight: '600', color: colors.successText },

    stepsCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 16,
      marginTop: 4,
    },
    stepsTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    stepIcon: { fontSize: 28, lineHeight: 36 },
    stepText: { flex: 1, gap: 2 },
    stepLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    stepDesc: { fontSize: 13, color: colors.textMuted },

    startBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 18,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
    startBtnDisabled: { opacity: 0.6 },
    startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    doneBtn: {
      backgroundColor: colors.mutedBg,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    doneBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },

    legal: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 8,
    },
  });
}
