import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

export interface FeeBreakdown {
  contributionAmountNgn: number;
  feeAmountNgn: number;
  totalChargedNgn: number;
}

export interface InitContribResult extends FeeBreakdown {
  authorizationUrl: string;
  reference: string;
}

export interface CanPayResult {
  can_pay: boolean;
  wallet_balance: number;
  contribution_amount: number;
  fee_amount: number;
  penalty_amount: number;
  total_amount: number;
}

export interface VerifyResult {
  status: string;
  amount?: number;
  groupId?: string;
  groupName?: string;
  cycleNumber?: number;
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

export function useCanPayFromWallet(cycleId: string | undefined) {
  return useQuery<CanPayResult>({
    queryKey: ['can-pay', cycleId],
    queryFn: () => apiClient.get(`wallet/can-pay/${cycleId}`).json<CanPayResult>(),
    enabled: !!cycleId,
    staleTime: 15_000,
  });
}

export function useNextPayout() {
  return useQuery({
    queryKey: ['next-payout'],
    queryFn: () => apiClient.get('payments/next-payout').json<NextPayout | null>(),
    staleTime: 60_000,
  });
}
