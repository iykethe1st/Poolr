'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

export type AdminGroup = {
  id: string;
  name: string;
  status: string;
  contributionAmount: number;
  frequency: string;
  maxMembers: number;
  currency: string;
  adminId: string;
  admin: { id: string; fullName: string; email: string };
  stats: { totalMembers: number; totalCycles: number; totalCollectedNgn: number };
};

export type Contribution = {
  id: string;
  memberId: string;
  memberName: string;
  userId: string;
  amount: number;
  status: string;
  dueAt: string;
  paidAt: string | null;
};

export type Payout = {
  id: string;
  amount: number;
  status: string;
  completedAt: string | null;
  reference?: string;
  transferCode?: string;
};

export type AdminCycle = {
  id: string;
  cycleNumber: number;
  dueDate: string;
  status: string;
  recipient: { id: string; fullName: string };
  payouts: Payout[];
  summary: { paid: number; pending: number; overdue: number; waived: number; total: number };
  contributions: Contribution[];
};

export type Penalty = {
  id: string;
  penaltyAmount: number;
  reason: string;
  status: string;
  appliedAt: string;
  waiveReason?: string | null;
  member: {
    id: string;
    user: { id: string; fullName: string; email: string };
    group: { id: string; name: string };
  };
  contribution: { id: string; amount: number; dueAt: string; paidAt: string | null };
};

export type GroupMemberDetail = {
  id: string;
  rotationPosition: number;
  memberStatus: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    kycProfile: { kycStatus: string } | null;
  };
  contributions: Contribution[];
  penalties: Penalty[];
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCurrentAdmin() {
  return useQuery<AdminUser>({
    queryKey: ['admin-me'],
    queryFn: () => apiClient.get('users/me').json<AdminUser>(),
    staleTime: 60_000,
  });
}

export function useAdminGroups() {
  return useQuery<AdminGroup[]>({
    queryKey: ['admin-groups'],
    queryFn: () => apiClient.get('admin/groups').json<AdminGroup[]>(),
    staleTime: 30_000,
  });
}

export function useAdminGroupCycles(groupId: string) {
  return useQuery<AdminCycle[]>({
    queryKey: ['admin-cycles', groupId],
    queryFn: () => apiClient.get(`admin/groups/${groupId}/cycles`).json<AdminCycle[]>(),
    staleTime: 30_000,
    enabled: !!groupId,
  });
}

export function useAdminGroupMembers(groupId: string) {
  return useQuery<GroupMemberDetail[]>({
    queryKey: ['admin-members', groupId],
    queryFn: () => apiClient.get(`admin/groups/${groupId}/members`).json<GroupMemberDetail[]>(),
    staleTime: 30_000,
    enabled: !!groupId,
  });
}

export function useAdminPenalties() {
  return useQuery<Penalty[]>({
    queryKey: ['admin-penalties'],
    queryFn: () => apiClient.get('admin/penalties').json<Penalty[]>(),
    staleTime: 30_000,
  });
}

export function useTriggerPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, cycleId }: { groupId: string; cycleId: string }) =>
      apiClient
        .post(`admin/groups/${groupId}/cycles/${cycleId}/trigger-payout`)
        .json<{ message: string; jobId: string }>(),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-cycles', vars.groupId] });
    },
  });
}

export function useWaivePenalty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ penaltyId, reason }: { penaltyId: string; reason?: string }) =>
      apiClient
        .post(`admin/penalties/${penaltyId}/waive`, { json: { reason } })
        .json<{ message: string }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-penalties'] });
      qc.invalidateQueries({ queryKey: ['admin-members'] });
    },
  });
}
