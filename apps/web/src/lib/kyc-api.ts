import { HTTPError } from 'ky';
import { apiClient } from './api';
import type { ApiResponse } from '@poolr/types';
import type { KycProfileDto } from '@poolr/types';

export type UserWithKyc = {
  id: string;
  fullName: string;
  email: string;
  kycProfile: KycProfileDto | null;
};

export function getMe(): Promise<UserWithKyc> {
  return apiClient.get('users/me').json<UserWithKyc>();
}

export function updateProfile(data: { fullName?: string }): Promise<void> {
  return apiClient.patch('users/me', { json: data }).json();
}

export async function extractHttpError(err: unknown): Promise<string> {
  if (err instanceof HTTPError) {
    try {
      const body = await err.response.json<ApiResponse>();
      return body.message ?? 'Something went wrong. Please try again.';
    } catch {
      return 'Something went wrong. Please try again.';
    }
  }
  return 'Network error. Check your connection and try again.';
}
