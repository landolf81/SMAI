/**
 * NotificationModal - 알림 모달 컴포넌트
 * Navbar 벨 아이콘 클릭 시 페이지 이동 대신 상단에서 슬라이드 다운으로 표시
 * push_logs 기반 알림 목록, 날짜 그룹핑, 상대 시간 포맷 포함
 * Props: isOpen, onClose
 */

import { useEffect, useRef } from 'react';
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

const NotificationModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const overlayRef = useRef(null);

  // 모달 열릴 때 마지막 확인 시간 기록
  useEffect(() => {
    if (isOpen) {
      localStorage.setItem(LAST_VIEW_KEY, String(Date.now()));
    }
  }, [isOpen]);

  // 모달 바깥 클릭 시 닫기
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
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

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notificationHistory'],
    queryFn: () => pushNotificationService.getNotificationHistory(50),
    staleTime: 60_000,
    enabled: isOpen,
  });

  const groups = groupByDate(notifications);

  const handleItemClick = (url) => {
    if (url) {
      onClose();
      navigate(url);
    }
  };

  if (!isOpen) return null;

  return (
    /* 반투명 오버레이: Navbar 아래에서 시작하도록 fixed + top-[57px] */
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 top-[57px] z-40 bg-black/30 backdrop-blur-[2px]"
      aria-modal="true"
      role="dialog"
      aria-label="알림"
    >
      {/* 모달 패널: 상단에서 슬라이드 다운 */}
      <div
        className="
          max-w-md mx-auto
          bg-base-100 rounded-b-2xl shadow-2xl
          border border-base-300/50
          overflow-hidden
          animate-slide-down
        "
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

        {/* 콘텐츠 영역: 스크롤 가능 */}
        <div className="overflow-y-auto max-h-[70vh] overscroll-contain">
          {/* 로딩 */}
          {isLoading && (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-base-300 border-t-base-content rounded-full animate-spin" />
            </div>
          )}

          {/* 빈 상태 */}
          {!isLoading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-base-content/40">
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
                  onClick={() => handleItemClick(n.url)}
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
      </div>
    </div>
  );
};

export default NotificationModal;
