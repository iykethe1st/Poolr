import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

export interface InitContribResult {
  authorizationUrl: string;
  reference: string;
}

export interface VerifyResult {
  status: string;
  amount?: number;
  paidAt?: string;
}

export interface NextPayout {
  groupId: string;
  groupName: string;
  amount: string;
  estimatedDate?: string;
}

const MOBILE_CONTRIB_CALLBACK = 'poolr://payment-callback';

export function useInitializeContribution() {
  return useMutation({
    mutationFn: ({ cycleId, useWallet = false }: { cycleId: string; useWallet?: boolean }) =>
      apiClient
        .post(`payments/contribute/${cycleId}`, {
          json: {
            paymentSource: useWallet ? 'WALLET' : 'PAYSTACK',
            callbackUrl: useWallet ? undefined : MOBILE_CONTRIB_CALLBACK,
          },
        })
        .json<InitContribResult>(),
  });
}

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reference: string) =>
      apiClient.get(`payments/verify/${reference}`).json<VerifyResult>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contributions'] });
      qc.invalidateQueries({ queryKey: ['group'] });
    },
  });
}

export function useNextPayout() {
  return useQuery({
    queryKey: ['next-payout'],
    queryFn: () => apiClient.get('payments/next-payout').json<NextPayout | null>(),
    staleTime: 60_000,
  });
}
