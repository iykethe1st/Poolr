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
import { Link } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { useColors } from '@/lib/colors';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setIsLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch (err: unknown) {
      let message = 'Unable to sign in. Check your connection and try again.';
      if (err && typeof err === 'object' && 'response' in err) {
        try {
          const body = await (err as { response: Response }).response.json() as { message?: string };
          if (body.message) message = body.message;
        } catch {
          // keep default
        }
      }
      Alert.alert('Login failed', message);
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoComplete="current-password"
            />
          </View>

          <Pressable
            style={[styles.btn, isLoading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnText}>Sign in</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Don't have an account?{' '}
          <Link href="/(auth)/register" style={styles.link}>
            Create one
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
    subtitle: { fontSize: 14, color: colors.textMuted, marginTop: -8 },
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
