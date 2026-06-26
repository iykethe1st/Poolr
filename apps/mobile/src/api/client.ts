import ky from 'ky';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'poolr_access_token';

// Update this to your local IP when testing on a physical device.
// Android emulator: http://10.0.2.2:3002/api
// iOS simulator / Expo Go on localhost: http://localhost:3002/api
export const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3002/api').replace(/\/$/, '');

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export const apiClient = ky.create({
  prefixUrl: API_BASE_URL,
  retry: { limit: 0 },
  hooks: {
    beforeRequest: [
      async (request) => {
        const token = await getToken();
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      },
    ],
  },
});

export const authClient = ky.create({
  prefixUrl: API_BASE_URL,
  retry: { limit: 0 },
});
