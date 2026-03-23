/**
 * Notifications - 알림 이력 페이지
 * 개인 알림(user_notifications) + 전체 공지(push_logs)를 created_at 기준 합쳐서 표시
 * 날짜별 그룹핑 + 상대 시간 표시 + 읽음 처리
 */

import { useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { pushNotificationService } from '../services/pushNotificationService';
import { notificationService } from '../services/notificationService';
import {
  formatRelativeTime,
  groupByDate,
  getNotificationIcon,
  getNotificationColor,
} from '../utils/notificationHelpers.jsx';

// 전체 공지 마지막 확인 시간 키 (Navbar와 공유)
const LAST_BROADCAST_VIEW_KEY = 'last_broadcast_view';

const Notifications = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 페이지 진입 시 공지 확인 시간 기록 (Navbar 뱃지용)
  useEffect(() => {
    localStorage.setItem(LAST_BROADCAST_VIEW_KEY, String(Date.now()));
  }, []);

  // 전체 공지 (push_logs)
  const { data: broadcastNotifications = [], isLoading: broadcastLoading } = useQuery({
    queryKey: ['notificationHistory'],
    queryFn: () => pushNotificationService.getNotificationHistory(100),
    staleTime: 60_000,
  });

  // 내 알림 (user_notifications)
  const { data: personalNotifications = [], isLoading: personalLoading } = useQuery({
    queryKey: ['personalNotifications'],
    queryFn: () => notificationService.getNotifications(100),
    staleTime: 30_000,
    enabled: !!currentUser,
  });

  // 미읽은 카운트
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unreadNotificationCount'],
    queryFn: () => notificationService.getUnreadCount(),
    staleTime: 30_000,
    enabled: !!currentUser,
  });

  // 두 목록을 created_at 기준으로 합쳐서 정렬
  const allNotifications = useMemo(() => {
    const broadcast = broadcastNotifications.map((n) => ({ ...n, _source: 'broadcast' }));
    const personal = personalNotifications.map((n) => ({ ...n, _source: 'personal' }));
    return [...broadcast, ...personal].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [broadcastNotifications, personalNotifications]);

  const isLoading = broadcastLoading || personalLoading;
  const groups = groupByDate(allNotifications);

  // 알림 클릭
  const handleClick = async (notification) => {
    if (notification._source === 'personal' && !notification.is_read) {
      await notificationService.markAsRead(notification.id);
      queryClient.invalidateQueries({ queryKey: ['personalNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] });
    }
    if (notification.url) navigate(notification.url);
  };

  // 전체 읽음
  const handleMarkAllRead = async () => {
    await notificationService.markAllAsRead();
    queryClient.invalidateQueries({ queryKey: ['personalNotifications'] });
    queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] });
  };

  return (
    <div className="max-w-md mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-200">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-base-content/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <h1 className="text-lg font-bold text-base-content">알림</h1>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-primary hover:text-primary-focus font-medium"
          >
            모두 읽음
          </button>
        )}
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-base-300 border-t-base-content rounded-full animate-spin" />
        </div>
      )}

      {/* 빈 상태 */}
      {!isLoading && allNotifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
          <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-sm">받은 알림이 없어요</p>
        </div>
      )}

      {/* 알림 목록 */}
      {!isLoading && groups.map((group) => (
        <div key={group.label}>
          <div className="px-4 py-2 bg-base-200/50 border-b border-base-200">
            <span className="text-xs font-semibold text-base-content/50">{group.label}</span>
          </div>

          {group.items.map((n) => (
            <button
              key={`${n._source}-${n.id}`}
              onClick={() => handleClick(n)}
              className={`w-full text-left px-4 py-3 border-b border-base-200 transition-colors ${
                n.url ? 'hover:bg-base-200/50 active:bg-base-200 cursor-pointer' : 'cursor-default'
              } ${n._source === 'personal' && !n.is_read ? 'bg-primary/5' : ''}`}
            >
              <div className="flex items-start gap-3">
                {/* 아이콘 */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  n._source === 'personal' ? getNotificationColor(n.type) : 'bg-primary/10 text-primary'
                }`}>
                  {n._source === 'personal' ? getNotificationIcon(n.type) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  )}
                </div>

                {/* 미읽은 표시 */}
                {n._source === 'personal' && !n.is_read && (
                  <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-base-content truncate">{n.title}</p>
                    <span className="text-[11px] text-base-content/40 flex-shrink-0">{formatRelativeTime(n.created_at)}</span>
                  </div>
                  {n.body && (
                    <p className="text-sm text-base-content/60 mt-0.5 line-clamp-2">{n.body}</p>
                  )}
                  {n._source === 'personal' && n.sender && (
                    <p className="text-xs text-base-content/40 mt-0.5">
                      {n.sender.name || n.sender.username || '탈퇴한 사용자'}
                    </p>
                  )}
                </div>

                {n.url && (
                  <svg className="w-4 h-4 text-base-content/30 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Notifications;
