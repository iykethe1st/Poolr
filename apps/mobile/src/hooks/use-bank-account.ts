import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { apiClient } from '@/api/client';

export async function getBankAccountErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (!(error instanceof HTTPError)) {
    return error instanceof Error ? error.message : fallback;
  }

  try {
    const body = (await error.response.json()) as {
      message?: string | string[];
    };
    if (Array.isArray(body.message) && body.message.length > 0) {
      return body.message[0];
    }
    if (typeof body.message === "string") {
      return body.message;
    }
  } catch {
    return `${fallback} (server error ${error.response.status})`;
  }

  return `${fallback} (server error ${error.response.status})`;
}

export interface BankAccount {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface Bank {
  code: string;
  name: string;
}

export function useMyBankAccount() {
  return useQuery({
    queryKey: ['bank-account'],
    queryFn: () => apiClient.get('bank-accounts/me').json<BankAccount | null>().catch(() => null),
    staleTime: 60_000,
  });
}

export function useBanks() {
  return useQuery({
    queryKey: ['banks'],
    queryFn: () => apiClient.get('bank-accounts/banks').json<Bank[]>(),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useResolveAccount() {
  return useMutation({
    mutationFn: ({ bankCode, accountNumber }: { bankCode: string; accountNumber: string }) =>
      apiClient
        .post('bank-accounts/resolve', { json: { bankCode, accountNumber } })
        .json<{ accountName: string }>(),
  });
}

export function useSaveBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { bankCode: string; bankName: string; accountNumber: string; accountName: string }) =>
      apiClient.post('bank-accounts', { json: data }).json<BankAccount>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-account'] }),
  });
}

export function useRemoveBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete('bank-accounts/me').json<{ message: string }>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-account'] }),
  });
}
