import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

export interface Wallet {
  id: string;
  balance: string;
  userId: string;
}

export interface WalletTransaction {
  id: string;
  type: string;
  direction: string;
  amount: string;
  description?: string;
  reference?: string;
  createdAt: string;
}

export interface TopUpResult {
  authorizationUrl: string;
  reference: string;
}

export interface VerifyTopUpResult {
  status: string;
  amount?: number;
}

const MOBILE_TOPUP_CALLBACK = 'poolr://topup-callback';

export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiClient.get('wallet').json<Wallet>(),
    staleTime: 30_000,
  });
}

export function useWalletTransactions(page = 1) {
  return useQuery({
    queryKey: ['wallet-transactions', page],
    queryFn: () =>
      apiClient
        .get('wallet/transactions', { searchParams: { page, limit: 20 } })
        .json<{ items: WalletTransaction[]; total: number; totalPages: number }>(),
    staleTime: 30_000,
  });
}

export function useTopUpWallet() {
  return useMutation({
    mutationFn: (amountNgn: number) =>
      apiClient
        .post('wallet/topup', { json: { amountNgn, callbackUrl: MOBILE_TOPUP_CALLBACK } })
        .json<TopUpResult>(),
  });
}

export function useVerifyTopUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reference: string) =>
      apiClient.get(`wallet/topup/verify/${reference}`).json<VerifyTopUpResult>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
    },
  });
}

export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amountNgn: number) =>
      apiClient.post('wallet/withdraw', { json: { amountNgn } }).json<{ message: string }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
    },
  });
}
