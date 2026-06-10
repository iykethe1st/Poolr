'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export type Notification = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  channel: string;
  createdAt: string;
};

export type NotificationsPage = {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
};

export function useNotificationBell() {
  return useQuery<NotificationsPage>({
    queryKey: ['notifications-bell'],
    queryFn: () =>
      apiClient
        .get('notifications', { searchParams: { limit: 6, page: 1 } })
        .json<NotificationsPage>(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useNotificationsList(page: number) {
  return useQuery<NotificationsPage>({
    queryKey: ['notifications-list', page],
    queryFn: () =>
      apiClient
        .get('notifications', { searchParams: { limit: 20, page } })
        .json<NotificationsPage>(),
    staleTime: 10_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`notifications/${id}/read`).json<{ message: string }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-bell'] });
      qc.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.patch('notifications/read-all').json<{ updated: number }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-bell'] });
      qc.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });
}
