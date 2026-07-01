import { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Feather } from '@expo/vector-icons';
import { useCurrentUser } from '@/hooks/use-dashboard';
import { useColors } from '@/lib/colors';
import { API_BASE_URL } from '@/api/client';
import { StatusBar } from 'expo-status-bar';

const DOJAH_WIDGET_ID = process.env.EXPO_PUBLIC_DOJAH_WIDGET_ID ?? '';

// Loaded at runtime so a dev build without the native module doesn't crash
let dojahSdk: { launch: (widgetId: string, refId: string | null, email: string | null) => Promise<string> } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  dojahSdk = require('dojah-kyc-sdk-react-expo').default;
} catch { /* native module not compiled into this build */ }

const STEPS: Array<{ icon: React.ComponentProps<typeof Feather>['name']; label: string; desc: string }> = [
  { icon: 'credit-card', label: 'Government-issued ID', desc: "National ID, passport, or driver's licence" },
  { icon: 'camera', label: 'Selfie check', desc: 'A quick photo to match your ID' },
  { icon: 'clock', label: 'Takes ~2 minutes', desc: 'Instant result in most cases' },
];

export default function KycScreen() {
  const { data: me, isLoading } = useCurrentUser();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const kycStatus = me?.kycProfile?.kycStatus ?? 'UNVERIFIED';
  const isVerified = kycStatus === 'VERIFIED';
  const isPending = kycStatus === 'PENDING' || kycStatus === 'UNDER_REVIEW';

  async function handleStart() {
    if (!me?.id) return;
    if (dojahSdk && DOJAH_WIDGET_ID) {
      // Defined outside try-catch so it's accessible in the catch block
      const attemptRef = `${me.id}-${Date.now()}`;
      try {
        await dojahSdk.restoreInteractions().catch(() => {});
        const result = await dojahSdk.launch(DOJAH_WIDGET_ID, attemptRef, me.email);
        if (result === 'closed') {
          // "closed" can mean genuine cancel OR SDK auto-dismissing after completion —
          // always verify so a completed session isn't silently discarded.
          router.replace({ pathname: '/kyc-callback', params: { status: 'success', reference_id: attemptRef } });
        } else {
          router.replace({ pathname: '/kyc-callback', params: { status: 'success', reference_id: attemptRef } });
        }
      } catch {
        // SDK threw — verification may still have completed (e.g. dismiss race condition).
        // Ask the backend rather than immediately showing failure.
        router.replace({ pathname: '/kyc-callback', params: { status: 'success', reference_id: attemptRef } });
      }
    } else {
      // Fallback for dev builds without native module compiled
      const widgetUrl = `${API_BASE_URL}/users/kyc/widget?user_id=${encodeURIComponent(me.id)}`;
      void WebBrowser.openBrowserAsync(widgetUrl, { dismissButtonStyle: 'cancel', toolbarColor: '#155e3e' });
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
          <Feather name="check-circle" size={16} color={colors.successText} />
          <Text style={styles.statusText}>Your identity has been verified</Text>
        </View>
      )}
      {isPending && (
        <View style={[styles.statusBanner, styles.statusPending]}>
          <Feather name="clock" size={16} color={colors.warningText} />
          <Text style={[styles.statusText, { color: colors.warningText }]}>
            Verification is in review — we'll notify you when it's complete
          </Text>
        </View>
      )}

      {/* What you'll need */}
      <View style={styles.stepsCard}>
        <Text style={styles.stepsTitle}>What you'll need</Text>
        {STEPS.map((s) => (
          <View key={s.label} style={styles.stepRow}>
            <View style={styles.stepIcon}>
              <Feather name={s.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepLabel}>{s.label}</Text>
              <Text style={styles.stepDesc}>{s.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {!isVerified && !isPending && (
        <TouchableOpacity
          style={styles.startBtn}
          onPress={handleStart}
          activeOpacity={0.85}
        >
          <Text style={styles.startBtnText}>Start Verification</Text>
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
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
    stepIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
