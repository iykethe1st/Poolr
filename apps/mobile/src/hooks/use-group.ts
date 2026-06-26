import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

export interface GroupMember {
  id: string;
  userId: string;
  memberStatus: string;
  joinedAt: string;
  position?: number;
  tier?: string;
  user: { id: string; fullName: string; email: string; phone?: string; kycProfile?: { kycStatus: string } };
}

export interface Cycle {
  id: string;
  cycleNumber: number;
  status: string;
  dueDate: string;
  disbursementDate?: string;
  recipientMemberId?: string;
  recipientMember?: { user: { fullName: string } };
  contributions?: Array<{
    id: string;
    status: string;
    memberId: string;
    amount: string;
    paidAt?: string;
  }>;
}

export interface GroupVirtualAccount {
  accountNumber: string;
  accountName: string;
  bankName: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  status: string;
  adminId: string;
  contributionAmount: string;
  frequency: string;
  maxMembers: number;
  startDate?: string;
  penaltyConfig?: { enabled: boolean; percentage?: number };
  members: GroupMember[];
  cycles: Cycle[];
  groupAccount: GroupVirtualAccount | null;
  _count?: { members: number };
}

export interface GroupContribution {
  id: string;
  cycleId: string;
  memberId: string;
  amount: string;
  status: string;
  paidAt: string | null;
  dueAt: string;
  createdAt: string;
  member: { user: { id: string; fullName: string } };
  cycle: { cycleNumber: number; status: string };
}

export interface GroupPayout {
  id: string;
  cycleId: string;
  recipientId: string;
  amount: string;
  status: string;
  initiatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  recipient: { id: string; fullName: string };
  cycle: { cycleNumber: number };
}

export interface GroupPenalty {
  id: string;
  memberId: string;
  penaltyAmount: string;
  reason: string;
  status: string;
  appliedAt: string | null;
  createdAt: string;
  member: { user: { id: string; fullName: string } };
  contribution: { dueAt: string; cycle: { cycleNumber: number } };
}

export interface HistoryMember {
  id: string;
  userId: string;
  rotationPosition: number;
  memberStatus: string;
  joinedAt: string;
  tier?: string;
  user: { id: string; fullName: string; email: string; kycProfile?: { kycStatus: string } };
}

export interface GroupHistory {
  contributions: GroupContribution[];
  payouts: GroupPayout[];
  penalties: GroupPenalty[];
  allMembers: HistoryMember[];
  potValueNgn: number;
}

export function useGroupDetail(id: string) {
  return useQuery({
    queryKey: ['group', id],
    queryFn: () => apiClient.get(`groups/${id}`).json<GroupDetail>(),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useGroupHistory(id: string) {
  return useQuery({
    queryKey: ['group', id, 'history'],
    queryFn: () => apiClient.get(`groups/${id}/history`).json<GroupHistory>(),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export interface CreateGroupInput {
  name: string;
  contributionAmount: number;
  frequency: string;
  maxMembers: number;
  startDate?: string;
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGroupInput) =>
      apiClient.post('groups', { json: data }).json<GroupDetail>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export interface InviteMemberInput {
  phone?: string;
  email?: string;
}

export interface InviteResult {
  message: string;
  token: string;
}

export function useInviteMember(groupId: string) {
  return useMutation({
    mutationFn: (data: InviteMemberInput) =>
      apiClient.post(`groups/${groupId}/invite`, { json: data }).json<InviteResult>(),
  });
}

export function useAcceptInvite(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post(`groups/${groupId}/accept-invite`).json<{ message: string }>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useDeclineInvite(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.delete(`groups/${groupId}/decline-invite`).json<{ message: string }>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useJoinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiClient.post('groups/join', { json: { token } }).json<{ message: string }>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}
