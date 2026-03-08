/**
 * MarketTrendTooltip - 시세 추세 차트 버튼 넛지
 * 홈 시세 카드의 차트 아이콘(ShowChartIcon) 위에 스포트라이트 + 말풍선
 * localStorage로 1회만 표시, 광장 넛지를 확인한 사용자에게만 노출
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const STORAGE_KEY = 'onboarding_market_trend_seen';
const LOUNGE_STORAGE_KEY = 'onboarding_lounge_seen';

const MarketTrendTooltip = () => {
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    // 광장 넛지를 아직 안 본 사용자는 광장 넛지 먼저
    if (!localStorage.getItem(LOUNGE_STORAGE_KEY)) return;

    const timer = setTimeout(() => {
      const el = document.querySelector('[data-onboarding="market-trend"]');
      if (!el) return;
      setTargetRect(el.getBoundingClientRect());
      setVisible(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const handleResize = () => {
      const el = document.querySelector('[data-onboarding="market-trend"]');
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

  const tooltipLeft = targetRect.left + targetRect.width / 2;
  const tooltipTop = targetRect.bottom + 12;

  return createPortal(
    <div className="fixed inset-0 z-[60]" onClick={handleDismiss}>
      <div className="absolute inset-0 bg-black/50" />

      {/* 스포트라이트 */}
      <div
        className="absolute bg-white/10 rounded-full"
        style={{
          top: targetRect.top - 6,
          left: targetRect.left - 6,
          width: targetRect.width + 12,
          height: targetRect.height + 12,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
        }}
      />

      {/* 말풍선 (버튼 아래) */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          right: 16,
          top: tooltipTop,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 삼각형 꼬리 (위 방향) */}
        <div
          className="w-0 h-0"
          style={{
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: '8px solid white',
            marginRight: 8,
            alignSelf: 'flex-end',
          }}
        />
        <div className="bg-white rounded-2xl shadow-xl px-6 py-4 whitespace-nowrap text-center">
          <p className="text-sm font-semibold text-gray-800 leading-snug">
            시세 추세를 그래프로 확인해요!
          </p>
          <button
            onClick={handleDismiss}
            className="mt-3 px-6 py-1.5 bg-[#1D4ED8] text-white text-sm font-semibold rounded-full"
          >
            확인
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MarketTrendTooltip;
