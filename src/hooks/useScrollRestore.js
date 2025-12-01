import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import scrollManager from '../utils/scrollManager';

/**
 * 게시판별 스크롤 위치 복원 훅 (뒤로가기시에만 복원)
 * @param {string} boardType - 게시판 타입 ('home', 'community', 'secondhand', 'profile' 등)
 * @param {string} tag - 태그 필터 (선택적)
 * @param {string} search - 검색어 (선택적)
 * @param {string} userId - 사용자 ID (선택적)
 * @param {boolean} enabled - 스크롤 복원 활성화 여부 (기본값: true)
 */
export const useScrollRestore = (boardType, tag = null, search = null, userId = null, enabled = true) => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const scrollTimeoutRef = useRef(null);
  const isInitializedRef = useRef(false);
  const lastScrollPositionRef = useRef(0);
  const isRestoringRef = useRef(false); // 스크롤 복원 중 플래그
  const mountNavigationTypeRef = useRef(navigationType); // 마운트 시점의 navigationType 저장

  // 스크롤 위치 저장 함수
  const saveCurrentScrollPosition = () => {
    if (!enabled) return;

    // 스크롤 복원 중에는 저장하지 않음
    if (isRestoringRef.current) {
      console.log(`⏸️ [${boardType}] 스크롤 복원 중이므로 저장 생략`);
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

    const isBackForward = navigationType === 'POP';

    console.log(`🔄 [${boardType}] useScrollRestore 초기화:`, {
      navigationType,
      isBackForward,
      pathname: location.pathname,
      tag,
      search
    });

    if (isBackForward) {
      // 뒤로가기/앞으로가기: 저장된 스크롤 위치 복원
      const savedScrollTop = scrollManager.restoreScrollPosition(boardType, tag, search, userId);

      console.log(`📜 [${boardType}] 저장된 스크롤 위치:`, savedScrollTop);

      if (savedScrollTop > 0) {
        isRestoringRef.current = true; // 복원 중 플래그 설정

        setTimeout(() => {
          window.scrollTo({
            top: savedScrollTop,
            behavior: 'instant'
          });
          lastScrollPositionRef.current = savedScrollTop;
          console.log(`✅ [${boardType}] 스크롤 복원 완료:`, savedScrollTop);

          // 복원 완료 후 500ms 후에 플래그 해제 (스크롤 이벤트 안정화 대기)
          setTimeout(() => {
            isRestoringRef.current = false;
            console.log(`🔓 [${boardType}] 스크롤 저장 재개`);
          }, 500);
        }, 100);
      }
    } else {
      // 일반 페이지 이동: 항상 최상단으로
      isRestoringRef.current = true; // 복원 중 플래그 설정

      setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: 'instant'
        });
        lastScrollPositionRef.current = 0;
        console.log(`⬆️ [${boardType}] 최상단으로 이동 (일반 페이지 이동)`);

        // 이동 완료 후 300ms 후에 플래그 해제
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
      // 컴포넌트 언마운트 시: 마운트 시점의 navigationType이 POP일 때만 저장
      // (PUSH 이동으로 들어온 페이지에서는 클릭으로 인한 스크롤 변경이 저장될 수 있음)
      const mountNavType = mountNavigationTypeRef.current;
      if (mountNavType === 'POP') {
        console.log(`📤 [${boardType}] 언마운트 시 스크롤 저장 (마운트 시 POP)`);
        saveCurrentScrollPosition();
      } else {
        console.log(`⏭️ [${boardType}] 언마운트 시 스크롤 저장 생략 (마운트 시 ${mountNavType})`);
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
          // 스크롤 저장을 디바운스 처리
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