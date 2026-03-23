/**
 * notificationHelpers - 알림 공통 유틸리티
 * 용도: 상대시간 포맷, 날짜 그룹핑, 알림 타입별 아이콘/색상
 * 사용처: NotificationModal.jsx, Notifications.jsx
 */

/** 상대 시간 포맷 (n분 전, n시간 전, n일 전) */
export const formatRelativeTime = (dateStr) => {
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
export const getDateLabel = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return '오늘';
  if (date.toDateString() === yesterday.toDateString()) return '어제';
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
};

/** 알림 목록을 날짜별로 그룹핑 */
export const groupByDate = (notifications) => {
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

/** 알림 타입별 아이콘 (SVG path) */
export const getNotificationIcon = (type) => {
  switch (type) {
    case 'comment':
    case 'reply':
      // 말풍선 아이콘
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case 'like':
      // 하트 아이콘
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case 'mention':
      // @ 아이콘
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9" />
        </svg>
      );
    case 'dm':
      // 편지 아이콘
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    default:
      // 벨 아이콘 (공지)
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      );
  }
};

/** 알림 타입별 배경색 클래스 */
export const getNotificationColor = (type) => {
  switch (type) {
    case 'comment':
    case 'reply':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
    case 'like':
      return 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400';
    case 'mention':
      return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
    case 'dm':
      return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  }
};

/** 알림 타입 한글 라벨 */
export const getNotificationLabel = (type) => {
  switch (type) {
    case 'comment': return '댓글';
    case 'reply': return '답글';
    case 'like': return '좋아요';
    case 'mention': return '멘션';
    case 'dm': return '메시지';
    default: return '알림';
  }
};
