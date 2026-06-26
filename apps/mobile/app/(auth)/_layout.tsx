import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useColors } from '@/lib/colors';
import { hasSeenOnboarding } from '../onboarding';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const colors = useColors();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingSeen, setOnboardingSeen] = useState(false);

  useEffect(() => {
    hasSeenOnboarding().then((seen) => {
      setOnboardingSeen(seen);
      setOnboardingChecked(true);
    });
  }, []);

  if (isLoading || !onboardingChecked) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isAuthenticated) return <Redirect href="/(tabs)/" />;
  if (!onboardingSeen) return <Redirect href="/onboarding" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify-otp" />
    </Stack>
  );
}
