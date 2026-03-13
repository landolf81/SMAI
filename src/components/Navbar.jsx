/**
 * Navbar - 상단 네비게이션 바
 * 다크모드 토글(좌측) + 로고(중앙) + 벨 아이콘(우측, 로그인 사용자만)
 * 미확인 알림 시 빨간 점 표시
 */

import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../config/supabase';

const LAST_VIEW_KEY = 'last_notifications_view';

const Navbar = () => {
  const { currentUser } = useContext(AuthContext);
  const { isDark, setTheme } = useTheme();
  const navigate = useNavigate();
  const [hasUnseen, setHasUnseen] = useState(false);

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
    localStorage.setItem(LAST_VIEW_KEY, String(Date.now()));
    setHasUnseen(false);
    navigate('/notifications');
  };

  return (
    <div className="bg-base-100/70 backdrop-blur-md border-b border-base-300/50 shadow-sm">
      <div className="max-w-md mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between">
          {/* 좌측 다크모드 토글 */}
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

          <Link to="/" className="flex items-center text-2xl text-base-content">
            <img src="/logo.svg" alt="로고" className="w-9 h-9 mr-1.5" />
            <span className="font-semibold">참외</span>
            <span className="font-semibold ml-0.5">이야기</span>
          </Link>

          {/* 벨 아이콘 (로그인 사용자만) */}
          {currentUser ? (
            <button
              onClick={handleBellClick}
              className="relative p-1 text-base-content/60 hover:text-base-content transition-colors"
              aria-label="알림"
            >
              <svg className="w-5 h-5" viewBox="0 0 25 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 23.79,20.96 L 21.83,18.64 C 21.39,18.13 21.14,17.36 21.14,16.6 V 12.22 C 21.14,8.36 18.46,4.81 14.61,3.72 L 14.57,3.71 V 3.11 C 14.57,1.85 13.61,0.83 12.42,0.83 H 12.41 C 11.17,0.83 10.29,1.83 10.29,3.19 V 3.69 L 10.25,3.7 C 6.42,4.73 4,8.25 4,12.22 V 16.78 C 4,17.57 3.79,18.25 3.33,18.78 L 1.36,20.99 C 0.91,21.51 0.78,22.21 1.03,22.87 C 1.31,23.51 1.87,23.89 2.58,23.89 H 8.71 L 8.72,23.94 C 9.03,25.74 10.54,27.17 12.46,27.17 H 12.47 C 14.28,27.17 15.88,25.72 16.28,23.89 L 16.29,23.83 H 22.36 C 23.07,23.83 23.71,23.42 23.98,22.74 C 24.23,22.08 24.09,21.41 23.79,20.96 Z M 11.33,3.19 C 11.33,2.46 11.86,1.77 12.47,1.77 C 13.16,1.77 13.61,2.44 13.61,3.11 V 3.49 L 13.54,3.48 C 13.18,3.43 12.81,3.4 12.44,3.4 C 12.11,3.4 11.77,3.43 11.38,3.49 L 11.33,3.49 V 3.19 Z M 12.46,26.06 H 12.45 C 11.14,26.06 10.09,25.08 9.78,23.87 L 9.76,23.79 H 15.18 L 15.16,23.87 C 14.82,25.11 13.78,26.06 12.46,26.06 Z M 23.06,22.33 C 22.92,22.63 22.68,22.76 22.36,22.76 H 2.69 C 2.35,22.76 2.09,22.65 1.97,22.36 C 1.83,22.01 1.91,21.66 2.13,21.4 L 4.1,19.08 C 4.69,18.39 4.88,17.42 4.88,16.6 V 12.22 C 4.88,7.97 8.09,4.49 12.44,4.49 C 16.79,4.49 20.06,7.88 20.06,12.13 V 16.6 C 20.06,17.57 20.35,18.64 20.91,19.3 L 22.87,21.58 C 23.11,21.87 23.18,22.08 23.06,22.33 Z" fill="currentColor" stroke="currentColor" strokeWidth="0.15"/>
                <path d="M 17.42,1.26 C 17.11,1.21 16.96,1.51 16.96,1.66 C 16.91,1.91 17.03,2.08 17.28,2.14 C 20.29,2.97 22.62,5.47 23.31,8.62 C 23.36,8.89 23.54,8.99 23.75,8.97 C 24.01,8.94 24.25,8.76 24.21,8.47 C 23.67,5.09 21.17,2.19 17.42,1.26 Z" fill="currentColor" stroke="currentColor" strokeWidth="0.1"/>
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
  );
};

export default Navbar;
