/**
 * OnboardingTooltip - 최초 접속자 UI 안내 말풍선
 * 광장 탭 위에 스포트라이트 + 말풍선으로 기능 안내
 * localStorage로 1회만 표시
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const STORAGE_KEY = 'onboarding_lounge_seen';

const OnboardingTooltip = () => {
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    // 이미 본 사용자는 표시 안 함
    if (localStorage.getItem(STORAGE_KEY)) return;

    // 대상 요소가 렌더된 후 위치 계산 (약간 딜레이)
    const timer = setTimeout(() => {
      const el = document.querySelector('[data-onboarding="lounge"]');
      if (!el) return;
      setTargetRect(el.getBoundingClientRect());
      setVisible(true);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // 리사이즈 시 위치 재계산
  useEffect(() => {
    if (!visible) return;

    const handleResize = () => {
      const el = document.querySelector('[data-onboarding="lounge"]');
      if (el) setTargetRect(el.getBoundingClientRect());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [visible]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }, []);

  if (!visible || !targetRect) return null;

  // 말풍선 위치: 대상 요소 중앙 위
  const tooltipLeft = targetRect.left + targetRect.width / 2;
  const tooltipBottom = window.innerHeight - targetRect.top + 12;

  return createPortal(
    <div className="fixed inset-0 z-[60]" onClick={handleDismiss}>
      {/* 반투명 오버레이 */}
      <div className="absolute inset-0 bg-black/50" />

      {/* 스포트라이트 (대상 요소만 밝게) */}
      <div
        className="absolute bg-white/10 rounded-xl"
        style={{
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
        }}
      />

      {/* 말풍선 */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          left: tooltipLeft,
          bottom: tooltipBottom,
          transform: 'translateX(-50%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white rounded-2xl shadow-xl px-5 py-4 max-w-[220px] text-center">
          <p className="text-sm font-semibold text-gray-800 leading-snug">
            실시간 채팅으로<br />이웃과 대화해요!
          </p>
          <button
            onClick={handleDismiss}
            className="mt-3 px-6 py-1.5 bg-[#FF7043] text-white text-sm font-semibold rounded-full"
          >
            확인
          </button>
        </div>

        {/* 삼각형 꼬리 (아래 방향) */}
        <div
          className="w-0 h-0"
          style={{
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid white',
          }}
        />
      </div>
    </div>,
    document.body
  );
};

export default OnboardingTooltip;
