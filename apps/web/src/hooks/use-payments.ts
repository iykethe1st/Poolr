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
