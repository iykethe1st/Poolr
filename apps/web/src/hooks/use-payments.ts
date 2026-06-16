'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export type InitContribResult = {
  authorizationUrl: string;
  reference: string;
};

export type VerifyResult = {
  status: 'success' | 'failed' | 'pending' | 'abandoned';
};

export function useInitializeContribution() {
  return useMutation({
    mutationFn: (cycleId: string) =>
      apiClient.post(`payments/contribute/${cycleId}`).json<InitContribResult>(),
  });
}

export type NextPayout = {
  groupId: string;
  groupName: string;
  cycleNumber: number;
  amountNgn: number;
  dueDate: string;
  isActive: boolean;
};

export function useNextPayout() {
  return useQuery<NextPayout | null>({
    queryKey: ['next-payout'],
    queryFn: () => apiClient.get('payments/next-payout').json<NextPayout | null>(),
    staleTime: 30_000,
  });
}

export type MyPayout = {
  id: string;
  amount: number;
  status: string;
  initiatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  cycle: {
    cycleNumber: number;
    group: { id: string; name: string };
  };
};

export function useMyPayouts() {
  return useQuery<MyPayout[]>({
    queryKey: ['my-payouts'],
    queryFn: () => apiClient.get('payments/payouts').json<MyPayout[]>(),
    staleTime: 30_000,
  });
}

export function useVerifyPayment(reference: string | null) {
  const qc = useQueryClient();

  return useQuery<VerifyResult>({
    queryKey: ['payment-verify', reference],
    queryFn: async () => {
      const result = await apiClient
        .get(`payments/verify/${reference}`)
        .json<VerifyResult>();

      if (result.status === 'success') {
        qc.invalidateQueries({ queryKey: ['contributions'] });
        qc.invalidateQueries({ queryKey: ['wallet'] });
      }

      return result;
    },
    enabled: !!reference,
    staleTime: 0,
    retry: false,
  });
}
