/**
 * Navbar - 상단 네비게이션 바
 * 다크모드 토글(좌측) + 로고(중앙) + PWA설치 버튼 + 벨 아이콘(우측, 로그인 사용자만)
 * 미확인 알림 시 빨간 점 표시
 * PWA 설치 가능(Android)할 때만 설치 아이콘 노출
 * 벨 아이콘 클릭 시 페이지 이동 대신 NotificationModal 표시
 */

import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { usePWAInstall } from '../hooks/usePWAInstall';
import NotificationModal from './NotificationModal';

const LAST_VIEW_KEY = 'last_notifications_view';

const Navbar = () => {
  const { currentUser } = useContext(AuthContext);
  const { isDark, setTheme } = useTheme();
  const [hasUnseen, setHasUnseen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // PWA 설치 훅 (Android에서 beforeinstallprompt 캡처)
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();

  // 미확인 알림 여부 체크
  useEffect(() => {
    if (!currentUser) return;

    const checkUnseen = async () => {
      try {
        const { data } = await supabase
          .from('push_logs')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          const lastViewed = localStorage.getItem(LAST_VIEW_KEY);
          if (!lastViewed || new Date(data.created_at) > new Date(Number(lastViewed))) {
            setHasUnseen(true);
          }
        }
      } catch {
        // 알림 없음 또는 테이블 미존재
      }
    };

    checkUnseen();
  }, [currentUser]);

  const handleBellClick = () => {
    setHasUnseen(false);
    setShowNotifications(true);
  };

  return (
    <>
    <div className="bg-base-100/70 backdrop-blur-md border-b border-base-300/50 shadow-sm">
      <div className="max-w-md mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between">
          {/* 좌측 다크모드 토글 */}
          <div className="flex-1">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="p-1.5 rounded-full text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors"
              aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>

          <Link to="/" className="flex items-center text-2xl text-base-content">
            <img src="/logo.svg" alt="로고" className="w-9 h-9 mr-1.5" />
            <span className="font-semibold">참외</span>
            <span className="font-semibold ml-0.5">이야기</span>
          </Link>

          {/* 우측 아이콘 영역: PWA 설치 버튼 + 벨 아이콘 */}
          <div className="flex-1 flex items-center gap-1 justify-end">
            {/* PWA 설치 버튼 (Android에서 설치 가능할 때만 표시) */}
            {canInstall && !isInstalled && (
              <button
                onClick={(e) => { e.stopPropagation(); promptInstall(); }}
                className="p-1.5 rounded-full text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors"
                aria-label="앱 설치"
                title="앱으로 설치하기"
              >
                {/* 모니터+다운로드 설치 아이콘 */}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="18" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 0l-2-2m2 2l2-2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 16v5" />
                </svg>
              </button>
            )}

            {/* 벨 아이콘 (로그인 사용자만) */}
            {currentUser ? (
              <button
                onClick={handleBellClick}
                className="relative p-1 text-base-content/60 hover:text-base-content transition-colors"
                aria-label="알림"
              >
                <svg className="w-5 h-5" viewBox="0 0 25 29" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="m24.01 21.21-2.5-2.84c-0.13-0.15-0.2-0.34-0.2-0.54v-5.77c0-0.57-0.07-1.12-0.19-1.62-0.47 0.24-0.99 0.34-1.52 0.34-1.98 0-3.53-1.64-3.53-3.59 0-1.05 0.46-1.98 1.04-2.62-0.77-0.5-1.62-0.86-2.48-1.04l-0.01-0.64c0-1.16-0.94-2.07-2.11-2.07h-0.02c-1.18 0-2.12 0.99-2.12 2.15v0.57c-3.76 0.94-6.62 4.49-6.62 8.52v5.77c0 0.2-0.07 0.39-0.2 0.54l-2.41 2.76c-0.93 1.08-0.13 2.88 1.34 2.88h20.12c1.33 0 2.22-1.6 1.41-2.8z" />
                  <path d="m19.64 9.76c1.49 0 2.75-1.25 2.75-2.61 0-1.47-1.16-2.62-2.7-2.62-1.47 0-2.63 1.19-2.63 2.62 0 1.46 1.16 2.61 2.58 2.61z" />
                  <path d="m12.44 28.18c1.84-0.08 3.3-1.46 3.59-3.13h-7.11c0.33 1.74 1.74 3.18 3.52 3.13z" />
                </svg>
                {hasUnseen && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
            ) : (
              <div className="w-8" />
            )}
          </div>
        </div>
      </div>
    </div>

    {/* 알림 모달 */}
    <NotificationModal
      isOpen={showNotifications}
      onClose={() => setShowNotifications(false)}
    />
    </>
  );
};

export default Navbar;
