import { HTTPError } from 'ky';
import { apiClient } from './api';
import type { ApiResponse } from '@poolr/types';
import type { KycProfileDto } from '@poolr/types';

export type KycSubmitResult = {
  kycStatus: string;
  kycAttempts: number;
  message: string;
};

export type UserWithKyc = {
  id: string;
  fullName: string;
  email: string;
  kycProfile: KycProfileDto | null;
};

export async function getMe(): Promise<UserWithKyc> {
  const res = await apiClient.get('users/me').json<ApiResponse<UserWithKyc>>();
  return res.data!;
}

export async function uploadKycFile(
  kind: 'selfie' | 'document',
  file: File | Blob,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', file, filename);
  const endpoint = kind === 'selfie' ? 'users/kyc/selfie' : 'users/kyc/document';
  const res = await apiClient
    .post(endpoint, { body: form })
    .json<ApiResponse<{ url: string }>>();
  return res.data!.url;
}

export async function submitKycIdentity(payload: {
  bvn?: string;
  nin?: string;
  dateOfBirth: string;
}): Promise<KycSubmitResult> {
  const res = await apiClient
    .post('users/kyc', { json: payload })
    .json<ApiResponse<KycSubmitResult>>();
  return res.data!;
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
