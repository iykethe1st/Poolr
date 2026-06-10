import ky, { type KyInstance } from 'ky';
import { getToken, clearToken } from './auth';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api';

// Bare client for auth routes — no Bearer header, no 401 redirect
export const authClient: KyInstance = ky.create({
  prefixUrl: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  retry: { limit: 0 },
  throwHttpErrors: true,
});

export const apiClient: KyInstance = ky.create({
  prefixUrl: API_BASE_URL,
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  retry: { limit: 0 },
  hooks: {
    beforeRequest: [
      (request) => {
        const token = getToken();
        if (token) request.headers.set('Authorization', `Bearer ${token}`);
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        if (response.status === 401) {
          clearToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return response;
      },
    ],
  },
});

// Typed helper — unwraps the standard { success, data } envelope
export async function apiFetch<T>(
  path: string,
  options?: Parameters<KyInstance['get']>[1],
): Promise<T> {
  const res = await apiClient.get(path, options).json<{ success: boolean; data: T }>();
  return res.data;
}
