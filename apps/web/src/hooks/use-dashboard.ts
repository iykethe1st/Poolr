'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const STALE = 30_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CurrentUser = {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  kycProfile: { kycStatus: string } | null;
};

export type WalletData = {
  id: string;
  userId: string;
  balance: number;
  currency: string;
};

export type GroupMemberSlim = {
  id: string;
  userId: string;
  rotationPosition: number;
  memberStatus: string;
};

export type GroupWithMembers = {
  id: string;
  adminId: string;
  name: string;
  contributionAmount: number;
  currency: string;
  frequency: string;
  maxMembers: number;
  status: string;
  startDate: string | null;
  createdAt: string;
  members: GroupMemberSlim[];
};

export type ContributionWithGroup = {
  id: string;
  cycleId: string;
  memberId: string;
  amount: number;
  status: string;
  dueAt: string;
  paidAt: string | null;
  cycle: {
    id: string;
    cycleNumber: number;
    dueDate: string;
    group: { id: string; name: string };
  };
};

export type NotificationsResult = {
  items: Array<{
    id: string;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: string;
  }>;
  total: number;
  unreadCount: number;
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCurrentUser() {
  return useQuery<CurrentUser>({
    queryKey: ['me'],
    queryFn: () => apiClient.get('users/me').json<CurrentUser>(),
    staleTime: STALE,
  });
}

export function useWallet() {
  return useQuery<WalletData>({
    queryKey: ['wallet'],
    queryFn: () => apiClient.get('wallet').json<WalletData>(),
    staleTime: STALE,
  });
}

export function useGroups() {
  return useQuery<GroupWithMembers[]>({
    queryKey: ['groups'],
    queryFn: () => apiClient.get('groups').json<GroupWithMembers[]>(),
    staleTime: STALE,
  });
}

export function useContributions() {
  return useQuery<ContributionWithGroup[]>({
    queryKey: ['contributions'],
    queryFn: () => apiClient.get('payments/contributions').json<ContributionWithGroup[]>(),
    staleTime: STALE,
  });
}

export function useNotifications() {
  return useQuery<NotificationsResult>({
    queryKey: ['notifications', { limit: 8 }],
    queryFn: () =>
      apiClient.get('notifications', { searchParams: { limit: 8, page: 1 } }).json<NotificationsResult>(),
    staleTime: STALE,
  });
}
