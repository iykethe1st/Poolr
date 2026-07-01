import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

export interface ContributionStats {
  tier: 'New' | 'Trusted' | 'Reliable' | 'Elite';
  trustScore: number;
  maxSlotsEligible: number;
  totalPaid: number;
  onTimePaid: number;
  onTimeRate: number;
  totalPenalties: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  status: string;
  kycProfile?: { kycStatus: string };
  contributionStats?: ContributionStats;
}

export interface GroupMemberSlim {
  id: string;
  userId: string;
  rotationPosition: number;
  memberStatus: string;
}

export interface GroupWithMembers {
  id: string;
  name: string;
  status: string;
  contributionAmount: string;
  frequency: string;
  maxMembers: number;
  currentCycle?: number;
  totalCycles?: number;
  startDate?: string;
  members: GroupMemberSlim[];
  _count?: { members: number };
}

export interface ContributionWithGroup {
  id: string;
  status: string;
  amount: string;
  dueAt?: string;
  paidAt?: string;
  cycle: {
    id: string;
    cycleNumber: number;
    dueDate: string;
    group: { id: string; name: string; contributionAmount: string };
  };
}

export function useCurrentUser(): UseQueryResult<CurrentUser> {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get('users/me').json<CurrentUser>(),
    staleTime: 60_000,
  });
}

export function useMyGroups(): UseQueryResult<GroupWithMembers[]> {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => apiClient.get('groups').json<GroupWithMembers[]>(),
    staleTime: 30_000,
  });
}

export function useMyContributions(): UseQueryResult<ContributionWithGroup[]> {
  return useQuery({
    queryKey: ['contributions'],
    queryFn: () => apiClient.get('payments/contributions').json<ContributionWithGroup[]>(),
    staleTime: 30_000,
  });
}

export function useVerifyKyc(): UseMutationResult<{ kycStatus: string }, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (referenceId: string) =>
      apiClient.post('users/kyc/verify', { json: { referenceId } }).json<{ kycStatus: string }>(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
