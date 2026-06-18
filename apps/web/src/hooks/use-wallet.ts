'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

export type Wallet = {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type WalletTransaction = {
  id: string;
  walletId: string;
  amount: number;
  type: 'CONTRIBUTION' | 'PAYOUT' | 'PENALTY' | 'TOPUP' | 'WITHDRAWAL' | 'REVERSAL';
  direction: 'CREDIT' | 'DEBIT';
  reference: string;
  createdAt: string;
};

export type WalletTransactionsPage = {
  items: WalletTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type TopUpResult = {
  authorizationUrl: string;
  reference: string;
};

export type VerifyTopUpResult = {
  status: 'success' | 'failed' | 'pending' | 'abandoned';
  amountNgn?: number;
};

export type WithdrawResult = {
  reference: string;
  transferCode: string;
};

export function useWallet() {
  return useQuery<Wallet>({
    queryKey: ['wallet'],
    queryFn: () => apiClient.get('wallet').json<Wallet>(),
    staleTime: 30_000,
  });
}

export function useWalletTransactions(page = 1, limit = 20) {
  return useQuery<WalletTransactionsPage>({
    queryKey: ['wallet-transactions', page, limit],
    queryFn: () =>
      apiClient.get(`wallet/transactions?page=${page}&limit=${limit}`).json<WalletTransactionsPage>(),
    staleTime: 30_000,
  });
}

export function useTopUpWallet() {
  const router = useRouter();
  return useMutation({
    mutationFn: (amountNgn: number) =>
      apiClient.post('wallet/topup', { json: { amountNgn } }).json<TopUpResult>(),
    onSuccess: ({ authorizationUrl, reference }) => {
      if (
        process.env.NODE_ENV === 'development' &&
        !authorizationUrl.startsWith('https://checkout.paystack')
      ) {
        router.push(`/payments/callback?reference=${reference}`);
      } else {
        window.location.href = authorizationUrl;
      }
    },
  });
}

export function useVerifyTopUp(reference: string | null) {
  const qc = useQueryClient();

  return useQuery<VerifyTopUpResult>({
    queryKey: ['topup-verify', reference],
    queryFn: async () => {
      const result = await apiClient
        .get(`wallet/topup/verify/${reference}`)
        .json<VerifyTopUpResult>();

      if (result.status === 'success') {
        qc.invalidateQueries({ queryKey: ['wallet'] });
        qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
      }

      return result;
    },
    enabled: !!reference,
    staleTime: 0,
    retry: false,
  });
}

export function useWithdrawFromWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amountNgn: number) =>
      apiClient.post('wallet/withdraw', { json: { amountNgn } }).json<WithdrawResult>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
    },
  });
}
