import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiClient } from '@/api/client';

const FCM_TOKEN_KEY = 'poolr_fcm_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPushToken(): Promise<void> {
  try {
    // Notifications aren't meaningful on web
    if (Platform.OS === 'web') return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (!token) return;

    // Skip if the token hasn't changed since last registration
    const cached = await SecureStore.getItemAsync(FCM_TOKEN_KEY);
    if (cached === token) return;

    await apiClient.patch('users/fcm-token', { json: { token } });
    await SecureStore.setItemAsync(FCM_TOKEN_KEY, token);
  } catch {
    // Silently swallow — fails without google-services.json in dev builds
  }
}

export async function clearPushToken(): Promise<void> {
  await SecureStore.deleteItemAsync(FCM_TOKEN_KEY);
}
