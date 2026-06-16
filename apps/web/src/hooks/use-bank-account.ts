'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export type Bank = {
  name: string;
  code: string;
  slug: string;
};

export type BankAccount = {
  id: string;
  userId: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  createdAt: string;
};

export type ResolveResult = {
  accountName: string;
  accountNumber: string;
};

export function useBanks() {
  return useQuery<Bank[]>({
    queryKey: ['banks'],
    queryFn: () => apiClient.get('bank-accounts/banks').json<Bank[]>(),
    staleTime: 1000 * 60 * 60 * 24, // 24 h
  });
}

export function useMyBankAccount() {
  return useQuery<BankAccount | null>({
    queryKey: ['bank-account'],
    queryFn: () => apiClient.get('bank-accounts/me').json<BankAccount | null>(),
    staleTime: 30_000,
  });
}

export function useResolveAccount() {
  return useMutation({
    mutationFn: (data: { bankCode: string; accountNumber: string }) =>
      apiClient.post('bank-accounts/resolve', { json: data }).json<ResolveResult>(),
  });
}

export function useSaveBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      bankCode: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
    }) => apiClient.post('bank-accounts', { json: data }).json<BankAccount>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-account'] });
      qc.invalidateQueries({ queryKey: ['my-payouts'] });
      // Invalidate all group history caches — payout statuses changed
      qc.invalidateQueries({ queryKey: ['group-history'], exact: false });
    },
  });
}

export function useRemoveBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.delete('bank-accounts/me').json<{ message: string }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-account'] });
    },
  });
}
