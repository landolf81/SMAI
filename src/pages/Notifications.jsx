/**
 * Notifications - 알림 이력 페이지
 * push_logs에서 최근 알림 목록을 표시
 * 날짜별 그룹핑 + 상대 시간 표시
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { pushNotificationService } from '../services/pushNotificationService';

const LAST_VIEW_KEY = 'last_notifications_view';

/** 상대 시간 포맷 (n분 전, n시간 전, n일 전) */
const formatRelativeTime = (dateStr) => {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
};

/** 날짜 그룹 라벨 (오늘, 어제, n월 n일) */
const getDateLabel = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return '오늘';
  if (date.toDateString() === yesterday.toDateString()) return '어제';
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
};

/** 알림 목록을 날짜별로 그룹핑 */
const groupByDate = (notifications) => {
  const groups = [];
  let currentLabel = null;

  for (const n of notifications) {
    const label = getDateLabel(n.created_at);
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, items: [] });
    }
    groups[groups.length - 1].items.push(n);
  }
  return groups;
};

const Notifications = () => {
  const navigate = useNavigate();

  // 페이지 진입 시 마지막 확인 시간 기록
  useEffect(() => {
    localStorage.setItem(LAST_VIEW_KEY, String(Date.now()));
  }, []);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notificationHistory'],
    queryFn: () => pushNotificationService.getNotificationHistory(50),
    staleTime: 60_000,
  });

  const groups = groupByDate(notifications);

  const handleClick = (url) => {
    if (url) navigate(url);
  };

  return (
    <div className="max-w-md mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-base-200">
        <svg className="w-5 h-5 text-base-content/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <h1 className="text-lg font-bold text-base-content">알림</h1>
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-base-300 border-t-base-content rounded-full animate-spin" />
        </div>
      )}

      {/* 빈 상태 */}
      {!isLoading && notifications.length === 0 && (
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
          {/* 날짜 구분 */}
          <div className="px-4 py-2 bg-base-200/50 border-b border-base-200">
            <span className="text-xs font-semibold text-base-content/50">{group.label}</span>
          </div>

          {group.items.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n.url)}
              className={`w-full text-left px-4 py-3 border-b border-base-200 transition-colors ${
                n.url ? 'hover:bg-base-200/50 active:bg-base-200 cursor-pointer' : 'cursor-default'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* 아이콘 */}
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-base-content truncate">{n.title}</p>
                    <span className="text-[11px] text-base-content/40 flex-shrink-0">{formatRelativeTime(n.created_at)}</span>
                  </div>
                  {n.body && (
                    <p className="text-sm text-base-content/60 mt-0.5 line-clamp-2">{n.body}</p>
                  )}
                </div>

                {/* 링크 화살표 */}
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
