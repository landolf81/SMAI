import { useState, useEffect, useRef } from 'react';

/**
 * 스크롤 방향 감지 훅 (개선된 버전)
 * @param {number} threshold - 스크롤 감지 임계값 (기본 10px)
 * @returns {string} 'up' | 'down'
 */
export const useScrollDirection = (threshold = 10) => {
  const [scrollDirection, setScrollDirection] = useState('up');
  const lastScrollYRef = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const updateScrollDirection = () => {
      const scrollY = window.scrollY;
      const lastScrollY = lastScrollYRef.current;

      if (Math.abs(scrollY - lastScrollY) < threshold) {
        ticking.current = false;
        return;
      }

      const direction = scrollY > lastScrollY ? 'down' : 'up';
      setScrollDirection(direction);
      lastScrollYRef.current = scrollY > 0 ? scrollY : 0;
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateScrollDirection);
        ticking.current = true;
      }
    };

    // 초기 스크롤 위치 설정
    lastScrollYRef.current = window.scrollY;

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return scrollDirection;
};
