import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 스크롤 방향 감지 훅 (즉시 반응 버전)
 * - 모든 스크롤 이벤트에서 즉시 방향 감지
 * - threshold 없이 바로 반응
 * - 페이지 상단(scrollY < 50)에서는 항상 'up' 반환 (헤더 표시)
 * @returns {string} 'up' | 'down'
 */
export const useScrollDirection = () => {
  const [scrollDirection, setScrollDirection] = useState('up');
  const lastScrollYRef = useRef(window.scrollY);
  const isRestoringScrollRef = useRef(false); // 스크롤 복원 중 플래그

  useEffect(() => {
    let ticking = false;

    // 스크롤 복원 시작 이벤트 리스너
    const handleScrollRestoreStart = () => {
      isRestoringScrollRef.current = true;
      // 복원 중에는 항상 'up' 상태 유지 (헤더/메뉴바 표시)
      setScrollDirection('up');
    };

    // 스크롤 복원 완료 이벤트 리스너
    const handleScrollRestoreEnd = () => {
      isRestoringScrollRef.current = false;
      lastScrollYRef.current = window.scrollY; // 현재 위치를 기준점으로 설정
    };

    const onScroll = () => {
      // 스크롤 복원 중이면 방향 감지 비활성화
      if (isRestoringScrollRef.current) {
        return;
      }

      if (ticking) return; // 이미 처리 중이면 스킵

      ticking = true;

      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const lastScrollY = lastScrollYRef.current;

        // 페이지 상단 근처에서는 항상 'up' (헤더/메뉴바 표시)
        if (scrollY < 50) {
          lastScrollYRef.current = scrollY;
          setScrollDirection('up');
          ticking = false;
          return;
        }

        // 스크롤 위치가 변하지 않았으면 무시
        if (scrollY === lastScrollY) {
          ticking = false;
          return;
        }

        // 방향 결정: 내려가면 down, 올라가면 up
        const newDirection = scrollY > lastScrollY ? 'down' : 'up';

        // 항상 lastScrollY 업데이트
        lastScrollYRef.current = scrollY;

        // 방향이 바뀔 때만 state 업데이트
        setScrollDirection(prev => {
          if (prev !== newDirection) {
            return newDirection;
          }
          return prev;
        });

        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll-restore-start', handleScrollRestoreStart);
    window.addEventListener('scroll-restore-end', handleScrollRestoreEnd);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll-restore-start', handleScrollRestoreStart);
      window.removeEventListener('scroll-restore-end', handleScrollRestoreEnd);
    };
  }, []);

  return scrollDirection;
};

/**
 * 스크롤 방향을 강제로 리셋하는 함수를 외부에서 호출할 수 있도록 export
 * 탭 전환 등에서 사용
 */
export const triggerScrollCheck = () => {
  window.dispatchEvent(new Event('scroll'));
};
