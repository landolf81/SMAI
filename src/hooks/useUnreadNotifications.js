/**
 * useUnreadNotifications - 미읽은 개인 알림 카운트 실시간 훅
 * 용도: Navbar 뱃지에 미읽은 알림 수 표시
 * TanStack Query + Supabase Realtime 조합
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../services/notificationService';

const QUERY_KEY = ['unreadNotificationCount'];

/**
 * @param {string|null} userId - 현재 로그인 사용자 ID
 * @returns {{ unreadCount: number, refetch: Function }}
 */
export function useUnreadNotifications(userId) {
  const queryClient = useQueryClient();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => notificationService.getUnreadCount(),
    enabled: !!userId,
    staleTime: 30_000, // 30초
    refetchInterval: 60_000, // 1분마다 폴링 (Realtime 백업)
  });

  // Supabase Realtime 구독: 새 알림 INSERT 시 카운트 갱신
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = notificationService.subscribeToNotifications(
      userId,
      () => {
        // 새 알림 도착 → 카운트 invalidate
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }
    );

    return unsubscribe;
  }, [userId, queryClient]);

  return { unreadCount, refetch };
}
