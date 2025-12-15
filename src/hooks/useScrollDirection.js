import { useState, useEffect, useRef } from 'react';

/**
 * 스크롤 방향 감지 훅 (즉시 반응 버전)
 * - 모든 스크롤 이벤트에서 즉시 방향 감지
 * - threshold 없이 바로 반응
 * @returns {string} 'up' | 'down'
 */
export const useScrollDirection = () => {
  const [scrollDirection, setScrollDirection] = useState('up');
  const lastScrollYRef = useRef(window.scrollY);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const lastScrollY = lastScrollYRef.current;

      // 스크롤 위치가 변하지 않았으면 무시
      if (scrollY === lastScrollY) return;

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
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return scrollDirection;
};
