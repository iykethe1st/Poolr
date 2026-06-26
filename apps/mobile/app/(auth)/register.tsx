import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { useColors } from '@/lib/colors';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [form, setForm] = useState({ email: '', phone: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  function set(key: keyof typeof form) {
    return (val: string) => setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleRegister() {
    if (!form.email || !form.phone || !form.password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    setIsLoading(true);
    try {
      await register({
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
      });
      router.push({ pathname: '/(auth)/verify-otp', params: { email: form.email.trim(), phone: form.phone.trim() } });
    } catch (err: unknown) {
      let msg = 'Registration failed. Please try again.';
      if (err && typeof err === 'object' && 'response' in err) {
        try {
          const body = await (err as { response: Response }).response.json() as { message?: string | string[] };
          const raw = body.message;
          msg = Array.isArray(raw) ? raw[0] : (raw ?? msg);
        } catch { /* fall through */ }
      } else if (err && typeof err === 'object' && 'message' in err) {
        msg = String((err as { message: string }).message);
      }
      Alert.alert('Registration failed', msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={styles.logoText}>Poolr</Text>
          <Text style={styles.tagline}>Save together, grow together</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Your name will be collected during identity verification</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={set('email')}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={set('phone')}
              placeholder="+234 800 000 0000"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={form.password}
              onChangeText={set('password')}
              placeholder="Choose a strong password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <Pressable
            style={[styles.btn, isLoading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnText}>Create account</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Already have an account?{' '}
          <Link href="/(auth)/login" style={styles.link}>
            Sign in
          </Link>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: import('@/lib/colors').Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    container: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 24 },
    header: { alignItems: 'center', gap: 6 },
    logo: { width: 64, height: 64, borderRadius: 16 },
    logoText: { fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: -1 },
    tagline: { fontSize: 14, color: colors.textMuted },
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
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: -8 },
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
    footer: { textAlign: 'center', fontSize: 14, color: colors.textMuted },
    link: { color: colors.primary, fontWeight: '600' },
  });
}
