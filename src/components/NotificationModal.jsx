/**
 * NotificationModal - 알림 모달 컴포넌트
 * Navbar 벨 아이콘 클릭 시 상단에서 슬라이드 다운으로 표시
 * 개인 알림(user_notifications) + 전체 공지(push_logs)를 created_at 기준 합쳐서 표시
 * Props: isOpen, onClose, onUnreadChange
 */

import { useEffect, useRef, useContext, useMemo } from 'react';
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

const NotificationModal = ({ isOpen, onClose, onUnreadChange }) => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const overlayRef = useRef(null);
  const queryClient = useQueryClient();

  // 모달 바깥 클릭 시 닫기
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // 스크롤 잠금
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // 모달 열릴 때 공지 확인 시간 기록 (Navbar 뱃지용)
  useEffect(() => {
    if (isOpen) {
      localStorage.setItem(LAST_BROADCAST_VIEW_KEY, String(Date.now()));
    }
  }, [isOpen]);

  // 전체 공지 (push_logs)
  const { data: broadcastNotifications = [], isLoading: broadcastLoading } = useQuery({
    queryKey: ['notificationHistory'],
    queryFn: () => pushNotificationService.getNotificationHistory(50),
    staleTime: 60_000,
    enabled: isOpen,
  });

  // 내 알림 (user_notifications)
  const { data: personalNotifications = [], isLoading: personalLoading } = useQuery({
    queryKey: ['personalNotifications'],
    queryFn: () => notificationService.getNotifications(50),
    staleTime: 30_000,
    enabled: isOpen && !!currentUser,
  });

  // 미읽은 개인 알림 수
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unreadNotificationCount'],
    queryFn: () => notificationService.getUnreadCount(),
    staleTime: 30_000,
    enabled: isOpen && !!currentUser,
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

  // 알림 클릭 핸들러
  const handleItemClick = async (notification) => {
    // 개인 알림이면 읽음 처리
    if (notification._source === 'personal' && !notification.is_read) {
      await notificationService.markAsRead(notification.id);
      queryClient.invalidateQueries({ queryKey: ['personalNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] });
      onUnreadChange?.();
    }
    if (notification.url) {
      onClose();
      navigate(notification.url);
    }
  };

  // 전체 읽음 처리
  const handleMarkAllRead = async () => {
    await notificationService.markAllAsRead();
    queryClient.invalidateQueries({ queryKey: ['personalNotifications'] });
    queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] });
    onUnreadChange?.();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 top-[57px] z-40 bg-black/30 backdrop-blur-[2px]"
      aria-modal="true"
      role="dialog"
      aria-label="알림"
    >
      <div
        className="max-w-md mx-auto bg-base-100 rounded-b-2xl shadow-2xl border border-base-300/50 overflow-hidden animate-slide-down"
        style={{ animationDuration: '220ms' }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-200">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-base-content/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h2 className="text-base font-bold text-base-content">알림</h2>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:text-primary-focus font-medium"
              >
                모두 읽음
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-base-content/50 hover:text-base-content hover:bg-base-200 transition-colors"
              aria-label="닫기"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="overflow-y-auto max-h-[70vh] overscroll-contain">
          {isLoading && (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-base-300 border-t-base-content rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && allNotifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-base-content/40">
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-sm">받은 알림이 없어요</p>
            </div>
          )}

          {!isLoading && groups.map((group) => (
            <div key={group.label}>
              <div className="px-4 py-2 bg-base-200/50 border-b border-base-200">
                <span className="text-xs font-semibold text-base-content/50">{group.label}</span>
              </div>

              {group.items.map((n) => (
                <button
                  key={`${n._source}-${n.id}`}
                  onClick={() => handleItemClick(n)}
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

                    {/* 미읽은 표시 (파란 점) */}
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
      </div>
    </div>
  );
};

export default NotificationModal;
