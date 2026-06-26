import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { authClient } from '@/api/client';
import { useColors } from '@/lib/colors';

export default function VerifyOtpScreen() {
  const { email, phone } = useLocalSearchParams<{ email: string; phone: string }>();
  const { login } = useAuth();
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function handleVerify() {
    if (!otp || !password) {
      Alert.alert('Missing fields', 'Please enter the OTP code and your password.');
      return;
    }
    setIsLoading(true);
    try {
      await authClient.post('auth/verify-otp', { json: { phone, otp } }).json();
      await login({ email: email ?? '', password });
    } catch (err: unknown) {
      let msg = 'Invalid or expired OTP. Please try again.';
      if (err && typeof err === 'object' && 'response' in err) {
        try {
          const body = await (err as { response: Response }).response.json() as { message?: string | string[] };
          const raw = body.message;
          msg = Array.isArray(raw) ? raw[0] : (raw ?? msg);
        } catch { /* fall through */ }
      }
      Alert.alert('Verification failed', msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    setIsResending(true);
    try {
      await authClient.post('auth/resend-otp', { json: { phone } }).json();
      Alert.alert('Sent', 'A new OTP has been sent to your email.');
    } catch {
      Alert.alert('Error', 'Could not resend OTP. Please try again.');
    } finally {
      setIsResending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={styles.logoText}>Poolr</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a verification code via SMS to{'\n'}
            <Text style={styles.email}>{phone}</Text>
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Verification code</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Your password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password to sign in"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoComplete="current-password"
            />
          </View>

          <Pressable
            style={[styles.btn, isLoading && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnText}>Verify and sign in</Text>
            )}
          </Pressable>

          <Pressable onPress={handleResend} disabled={isResending} style={styles.resend}>
            {isResending ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.resendText}>Didn't receive it? Resend code</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: import('@/lib/colors').Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, padding: 24, gap: 24 },
    back: { paddingTop: 12 },
    backText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
    header: { alignItems: 'center', gap: 6 },
    logo: { width: 64, height: 64, borderRadius: 16 },
    logoText: { fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: -1 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      gap: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textMuted, marginTop: -8, lineHeight: 20 },
    email: { fontWeight: '600', color: colors.text },
    field: { gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: colors.text },
    input: {
      height: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.inputBg,
    },
    otpInput: { fontSize: 24, fontWeight: '700', letterSpacing: 8, height: 56 },
    btn: {
      height: 48,
      backgroundColor: colors.primary,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    resend: { alignItems: 'center', paddingVertical: 4 },
    resendText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  });
}
