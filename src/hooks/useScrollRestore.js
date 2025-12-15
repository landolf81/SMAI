import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import scrollManager from '../utils/scrollManager';

/**
 * 게시판별 스크롤 위치 복원 훅 (페이지 재방문 시 복원, 캐시 만료 시 최상단)
 * @param {string} boardType - 게시판 타입 ('home', 'community', 'secondhand', 'profile' 등)
 * @param {string} tag - 태그 필터 (선택적)
 * @param {string} search - 검색어 (선택적)
 * @param {string} userId - 사용자 ID (선택적)
 * @param {boolean} enabled - 스크롤 복원 활성화 여부 (기본값: true)
 * @param {boolean} isCacheValid - 캐시 유효 여부 (선택적, true면 스크롤 복원, false면 최상단)
 */
export const useScrollRestore = (boardType, tag = null, search = null, userId = null, enabled = true, isCacheValid = true) => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const scrollTimeoutRef = useRef(null);
  const isInitializedRef = useRef(false);
  const lastScrollPositionRef = useRef(0);
  const isRestoringRef = useRef(false); // 스크롤 복원 중 플래그
  const mountNavigationTypeRef = useRef(navigationType); // 마운트 시점의 navigationType 저장

  // boardType과 pathname 매핑
  const getExpectedPathname = (type) => {
    const pathMap = {
      'home': '/',
      'community': '/community',
      'secondhand': '/secondhand',
      'qna': '/qna',
      'profile': '/profile'
    };
    return pathMap[type] || `/${type}`;
  };

  // 스크롤 위치 저장 함수
  const saveCurrentScrollPosition = () => {
    if (!enabled) return;

    // 스크롤 복원 중에는 저장하지 않음
    if (isRestoringRef.current) {
      return;
    }

    // 현재 경로가 해당 boardType 경로가 아니면 저장하지 않음
    const expectedPath = getExpectedPathname(boardType);
    if (!location.pathname.startsWith(expectedPath) || location.pathname.includes('/post/')) {
      return;
    }

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

    // 스크롤 위치가 실제로 변경된 경우에만 저장
    if (Math.abs(scrollTop - lastScrollPositionRef.current) > 10) {
      scrollManager.saveScrollPosition(boardType, scrollTop, tag, search, userId);
      lastScrollPositionRef.current = scrollTop;
    }
  };

  // 페이지 초기화 처리
  useEffect(() => {
    if (isInitializedRef.current) return;

    // 캐시가 유효하면 저장된 스크롤 위치 복원 (뒤로가기 + 일반 페이지 이동 모두)
    const savedScrollTop = scrollManager.restoreScrollPosition(boardType, tag, search, userId);

    if (savedScrollTop > 0 && isCacheValid) {
      isRestoringRef.current = true;

      setTimeout(() => {
        window.scrollTo({
          top: savedScrollTop,
          behavior: 'instant'
        });
        lastScrollPositionRef.current = savedScrollTop;

        setTimeout(() => {
          isRestoringRef.current = false;
        }, 500);
      }, 100);
    } else {
      // 캐시 무효 또는 저장된 위치가 없으면 최상단
      isRestoringRef.current = true;
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        lastScrollPositionRef.current = 0;
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 300);
      }, 50);
    }

    isInitializedRef.current = true;
  }, [location.pathname, boardType, tag, search, userId, navigationType, enabled]);

  // 마운트 시점의 navigationType 업데이트
  useEffect(() => {
    mountNavigationTypeRef.current = navigationType;
  }, [navigationType]);

  // 페이지 이동 시 현재 스크롤 위치 저장
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveCurrentScrollPosition();
    };

    // 페이지 언로드 시 스크롤 위치 저장
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // 컴포넌트 언마운트 시: 마지막으로 기록된 스크롤 위치 저장
      // (스크롤 이벤트에서 추적한 위치 사용 - 현재 window.scrollY는 이미 변경되었을 수 있음)
      if (!isRestoringRef.current && enabled && lastScrollPositionRef.current > 0) {
        scrollManager.saveScrollPosition(boardType, lastScrollPositionRef.current, tag, search, userId);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [boardType, tag, search, userId, enabled]);

  // 스크롤 이벤트 리스너 (저장용)
  useEffect(() => {
    if (!enabled) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          // 스크롤 복원 중에는 무시
          if (isRestoringRef.current) {
            ticking = false;
            return;
          }

          // 현재 스크롤 위치를 즉시 ref에 저장 (언마운트 시 사용)
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
          lastScrollPositionRef.current = scrollTop;

          // localStorage 저장은 디바운스 처리
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }

          scrollTimeoutRef.current = setTimeout(() => {
            saveCurrentScrollPosition();
          }, 300); // 300ms 후에 저장

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [boardType, tag, search, userId, enabled]);

  // 페이지가 변경될 때마다 초기화 상태 리셋
  useEffect(() => {
    isInitializedRef.current = false;
  }, [location.pathname]);

  // 유틸리티 함수들
  const resetScrollPosition = () => {
    scrollManager.clearScrollPosition(boardType, tag, search, userId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    lastScrollPositionRef.current = 0;
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // 스크롤 저장은 하지 않음 (의도적인 탑 이동)
  };

  return {
    resetScrollPosition,
    scrollToTop,
    saveCurrentScrollPosition
  };
};