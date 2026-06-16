'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const STALE = 30_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type GroupMemberUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
};

export type GroupMember = {
  id: string;
  userId: string;
  groupId: string;
  rotationPosition: number;
  memberStatus: string;
  joinedAt: string;
  user: GroupMemberUser;
};

export type Cycle = {
  id: string;
  groupId: string;
  recipientId: string;
  cycleNumber: number;
  dueDate: string;
  payoutDate: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type GroupVirtualAccount = {
  accountNumber: string;
  accountName: string;
  bankName: string;
};

export type GroupDetail = {
  id: string;
  adminId: string;
  name: string;
  contributionAmount: number;
  currency: string;
  frequency: string;
  maxMembers: number;
  status: string;
  startDate: string | null;
  penaltyConfig: unknown;
  createdAt: string;
  updatedAt: string;
  members: GroupMember[];
  cycles: Cycle[];
  groupAccount: GroupVirtualAccount | null;
};

// ─── History Types ────────────────────────────────────────────────────────────

export type HistoryMember = {
  id: string;
  userId: string;
  rotationPosition: number;
  memberStatus: string;
  joinedAt: string;
  user: { id: string; fullName: string; email: string };
};

export type GroupContribution = {
  id: string;
  cycleId: string;
  memberId: string;
  amount: number;
  status: string;
  paidAt: string | null;
  dueAt: string;
  createdAt: string;
  member: { user: { id: string; fullName: string } };
  cycle: { cycleNumber: number; status: string };
};

export type GroupPayout = {
  id: string;
  cycleId: string;
  recipientId: string;
  amount: number;
  status: string;
  initiatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  recipient: { id: string; fullName: string };
  cycle: { cycleNumber: number };
};

export type GroupPenalty = {
  id: string;
  memberId: string;
  penaltyAmount: number;
  reason: string;
  status: string;
  appliedAt: string | null;
  createdAt: string;
  member: { user: { id: string; fullName: string } };
  contribution: { dueAt: string; cycle: { cycleNumber: number } };
};

export type GroupHistory = {
  contributions: GroupContribution[];
  payouts: GroupPayout[];
  penalties: GroupPenalty[];
  allMembers: HistoryMember[];
  potValueNgn: number;
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useGroup(id: string) {
  return useQuery<GroupDetail>({
    queryKey: ['group', id],
    queryFn: () => apiClient.get(`groups/${id}`).json<GroupDetail>(),
    staleTime: STALE,
    enabled: !!id,
  });
}

export function useGroupHistory(id: string, enabled = true) {
  return useQuery<GroupHistory>({
    queryKey: ['group-history', id],
    queryFn: () => apiClient.get(`groups/${id}/history`).json<GroupHistory>(),
    staleTime: STALE,
    enabled: !!id && enabled,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export type CreateGroupInput = {
  name: string;
  contributionAmount: number;
  frequency: string;
  maxMembers: number;
  startDate?: string;
  penaltyConfig?: unknown;
};

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGroupInput) =>
      apiClient.post('groups', { json: data }).json<GroupDetail>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useUpdateGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<CreateGroupInput, 'currency'>>) =>
      apiClient.patch(`groups/${groupId}`, { json: data }).json<GroupDetail>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useInviteMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { phone?: string; email?: string }) =>
      apiClient
        .post(`groups/${groupId}/invite`, { json: data })
        .json<{ message: string; memberId: string; token: string }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', groupId] });
    },
  });
}

export function useUpdatePosition(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, position }: { memberId: string; position: number }) =>
      apiClient
        .patch(`groups/${groupId}/members/${memberId}/position`, { json: { position } })
        .json<{ message: string }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', groupId] });
    },
  });
}

export function useRemoveMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      apiClient
        .delete(`groups/${groupId}/members/${memberId}`)
        .json<{ message: string }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', groupId] });
    },
  });
}

export function useStartGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient
        .post(`groups/${groupId}/start`)
        .json<{ message: string; cyclesGenerated: number }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useJoinGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiClient
        .post(`groups/${groupId}/join`, { json: { token } })
        .json<{ message: string }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['group', groupId] });
    },
  });
}

export function useAcceptInvite(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient
        .post(`groups/${groupId}/accept-invite`)
        .json<{ message: string }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['group', groupId] });
    },
  });
}

export function useDeclineInvite(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient
        .delete(`groups/${groupId}/decline-invite`)
        .json<{ message: string }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['group', groupId] });
    },
  });
}
