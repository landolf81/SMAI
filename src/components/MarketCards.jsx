import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useNavigationType } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adService } from '../services';
import MobileAdDisplay from './MobileAdDisplay';
import { shouldShowAds } from '../utils/deviceDetector';

// 스크롤 시 요소가 화면 중앙에 가까워지면 선명해지는 커스텀 훅
const useScrollFadeIn = () => {
  const [visibleItems, setVisibleItems] = useState({});
  const observerRef = useRef(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.dataset.cardId;
          if (id) {
            setVisibleItems((prev) => ({
              ...prev,
              [id]: entry.intersectionRatio
            }));
          }
        });
      },
      {
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        rootMargin: '-10% 0px -10% 0px'
      }
    );

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const observe = useCallback((element) => {
    if (element && observerRef.current) {
      observerRef.current.observe(element);
    }
  }, []);

  const unobserve = useCallback((element) => {
    if (element && observerRef.current) {
      observerRef.current.unobserve(element);
    }
  }, []);

  return { visibleItems, observe, unobserve };
};

const MarketCards = ({ marketData, loading, selectedDate, formatPrice, formatDateForDisplay, handleRefresh }) => {
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  // 스크롤 페이드 인 효과
  const { visibleItems, observe, unobserve } = useScrollFadeIn();
  const cardRefs = useRef({});

  // 순차적 렌더링을 위한 상태
  const [renderedCount, setRenderedCount] = useState(0);
  const renderIntervalRef = useRef(null);

  // 카드 ref 설정 및 관찰
  const setCardRef = useCallback((element, id) => {
    if (element) {
      cardRefs.current[id] = element;
      observe(element);
    }
  }, [observe]);

  // 컴포넌트 언마운트 시 관찰 해제
  useEffect(() => {
    return () => {
      Object.values(cardRefs.current).forEach((element) => {
        if (element) unobserve(element);
      });
    };
  }, [unobserve]);


  // 활성 광고 데이터 가져오기 (모바일에서만)
  const { data: adsData, error: adsError, isLoading: adsLoading } = useQuery({
    queryKey: ['ads', 'active', 'market'],
    queryFn: () => adService.getActiveAds('market'),
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    enabled: shouldShowAds(), // PC에서는 쿼리 비활성화
    retry: 2, // 재시도 횟수
    onError: (error) => {
      console.error('❌ 광고 API 에러:', error);
    }
  });

  const handleCardClick = (marketName) => {
    navigate(`/prices?market=${encodeURIComponent(marketName)}&date=${selectedDate}`);
  };

  // 공판장별 색상 테마 정의 (PANTONE 색상표 기반 그라데이션)
  // Yellow: PANTONE 7548 C (#FFCC00), Green: PANTONE 2271 C (#00B140), Midnight Blue: PANTONE 7701 C (#1D4F91)
  const getMarketTheme = (marketName) => {
    const themes = {
      // 가락공판장 - Green → Midnight Blue
      '가락': {
        bg: 'from-[#00B140] to-[#1D4F91]',
        badgeColor: '#00B140', // Green (그라데이션 시작색)
        text: 'text-[#1D4F91]',
        light: 'bg-blue-50',
        gradient: 'linear-gradient(135deg, rgba(0, 177, 64, 0.15) 0%, rgba(29, 79, 145, 0.05) 100%)'
      },
      // 선남농협 - Yellow → Green
      '선남': {
        bg: 'from-[#FFCC00] to-[#00B140]',
        badgeColor: '#FFCC00', // Yellow (그라데이션 시작색)
        text: 'text-[#00B140]',
        light: 'bg-[#F5F9E0]',
        gradient: 'linear-gradient(135deg, rgba(255, 204, 0, 0.15) 0%, rgba(0, 177, 64, 0.05) 100%)'
      },
      // 성주원예 - Midnight Blue → Yellow
      '성주원예': {
        bg: 'from-[#1D4F91] to-[#FFCC00]',
        badgeColor: '#1D4F91', // Midnight Blue (그라데이션 시작색)
        text: 'text-[#1D4F91]',
        light: 'bg-yellow-50',
        gradient: 'linear-gradient(135deg, rgba(29, 79, 145, 0.15) 0%, rgba(255, 204, 0, 0.05) 100%)'
      },
      // 성주조공 - Yellow → Midnight Blue
      '성주조공': {
        bg: 'from-[#FFCC00] to-[#1D4F91]',
        badgeColor: '#FFCC00', // Yellow (그라데이션 시작색)
        text: 'text-[#1D4F91]',
        light: 'bg-blue-50',
        gradient: 'linear-gradient(135deg, rgba(255, 204, 0, 0.15) 0%, rgba(29, 79, 145, 0.05) 100%)'
      },
      // 용암농협 - Green → Yellow
      '용암': {
        bg: 'from-[#00B140] to-[#FFCC00]',
        badgeColor: '#00B140', // Green (그라데이션 시작색)
        text: 'text-[#00B140]',
        light: 'bg-yellow-50',
        gradient: 'linear-gradient(135deg, rgba(0, 177, 64, 0.15) 0%, rgba(255, 204, 0, 0.05) 100%)'
      },
      // 초전농협 - Midnight Blue → Green
      '초전': {
        bg: 'from-[#1D4F91] to-[#00B140]',
        badgeColor: '#1D4F91', // Midnight Blue (그라데이션 시작색)
        text: 'text-[#00B140]',
        light: 'bg-green-50',
        gradient: 'linear-gradient(135deg, rgba(29, 79, 145, 0.15) 0%, rgba(0, 177, 64, 0.05) 100%)'
      },
      // 기본 성주 농협들 - Yellow → Green
      '성주': {
        bg: 'from-[#FFCC00] to-[#00B140]',
        badgeColor: '#FFCC00', // Yellow (그라데이션 시작색)
        text: 'text-[#00B140]',
        light: 'bg-green-50',
        gradient: 'linear-gradient(135deg, rgba(255, 204, 0, 0.15) 0%, rgba(0, 177, 64, 0.05) 100%)'
      }
    };

    // 시장명에서 키워드 매칭 (정확한 매칭)
    for (const [key, theme] of Object.entries(themes)) {
      if (marketName.includes(key)) {
        return theme;
      }
    }

    // 기본 테마 (성주/녹색)
    return themes['성주'];
  };

  // 카드 배경색 생성 함수 (PANTONE 색상 기반)
  const getCardBackgroundColor = (theme) => {
    const colorMap = {
      'from-[#00B140] to-[#1D4F91]': 'rgba(0, 177, 64, 0.08)',      // Green → Blue
      'from-[#FFCC00] to-[#00B140]': 'rgba(255, 204, 0, 0.08)',     // Yellow → Green
      'from-[#1D4F91] to-[#FFCC00]': 'rgba(29, 79, 145, 0.08)',     // Blue → Yellow
      'from-[#FFCC00] to-[#1D4F91]': 'rgba(255, 204, 0, 0.08)',     // Yellow → Blue
      'from-[#00B140] to-[#FFCC00]': 'rgba(0, 177, 64, 0.08)',      // Green → Yellow
      'from-[#1D4F91] to-[#00B140]': 'rgba(29, 79, 145, 0.08)',     // Blue → Green
    };

    return colorMap[theme.bg] || 'rgba(0, 177, 64, 0.08)'; // 기본값: Green
  };

  // 등락 계산 및 표시 함수 (금액차만 표시, 중앙 정렬)
  const renderPriceChange = (currentPrice, previousPrice, unit = '원') => {
    if (!previousPrice || previousPrice === 0) return null;

    const change = currentPrice - previousPrice;
    const isPositive = change > 0;

    if (change === 0) return <span className="text-gray-500 text-xs">보합</span>;

    return (
      <div className="flex items-center justify-center space-x-1 text-xs">
        <span className={isPositive ? 'text-red-500' : 'text-blue-500'}>
          {isPositive ? '▲' : '▼'}
        </span>
        <span className={isPositive ? 'text-red-500' : 'text-blue-500'}>
          {Math.abs(change).toLocaleString()}{unit}
        </span>
      </div>
    );
  };

  // 순차적 렌더링: 데이터 로드 후 카드를 위에서부터 순서대로 표시
  useEffect(() => {
    // 로딩 중이거나 데이터가 없으면 스킵
    if (loading || !marketData || marketData.length === 0) {
      setRenderedCount(0);
      return;
    }

    // 뒤로가기(POP)일 때는 즉시 모두 표시
    if (navigationType === 'POP') {
      setRenderedCount(marketData.length);
      return;
    }

    // 이미 모두 렌더링 완료된 경우
    if (renderedCount >= marketData.length) {
      return;
    }

    // 기존 인터벌 정리
    if (renderIntervalRef.current) {
      clearInterval(renderIntervalRef.current);
    }

    // 첫 번째 아이템 즉시 표시
    if (renderedCount === 0) {
      setRenderedCount(1);
    }

    // 나머지 아이템 순차적 표시 (80ms 간격 - 카드가 크므로 좀 더 여유있게)
    renderIntervalRef.current = setInterval(() => {
      setRenderedCount(prev => {
        if (prev >= marketData.length) {
          clearInterval(renderIntervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 80);

    return () => {
      if (renderIntervalRef.current) {
        clearInterval(renderIntervalRef.current);
      }
    };
  }, [loading, marketData?.length, navigationType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 loading-container safe-area-top safe-area-bottom">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="mt-4 text-gray-600">경락가 정보를 불러오는 중...</p>
          <div className="mt-2 text-sm text-gray-500">
            {formatDateForDisplay(selectedDate)} 데이터 조회 중
          </div>
        </div>
      </div>
    );
  }

  if (!marketData || marketData.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 max-w-md mx-auto">
            <div className="mb-6">
              <img 
                src="/images/AS_110.png" 
                alt="경락가 정보 없음" 
                className="w-full h-auto mx-auto opacity-80 rounded-lg"
              />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-3">경락가 정보가 없습니다</h3>
          </div>
        </div>
        
        {/* 경락가 정보가 없을 때 광고 표시 */}
        {shouldShowAds() && adsData && adsData.length > 0 && (
          <div className="mt-4">
            <MobileAdDisplay 
              ad={adsData[0]}
            />
          </div>
        )}
      </div>
    );
  }

  // 카드 투명도 계산 (화면 중앙에 가까울수록 선명)
  const getCardOpacity = (cardId, index) => {
    const ratio = visibleItems[cardId];
    if (ratio === undefined) {
      // 첫 번째 카드는 기본적으로 보이게
      return index === 0 ? 1 : 0.3;
    }
    // 최소 0.3, 최대 1의 투명도
    return Math.max(0.3, ratio);
  };

  // 카드 스케일 계산 (화면 중앙에 가까울수록 크게)
  const getCardScale = (cardId, index) => {
    const ratio = visibleItems[cardId];
    if (ratio === undefined) {
      return index === 0 ? 1 : 0.95;
    }
    // 최소 0.95, 최대 1의 스케일
    return 0.95 + (ratio * 0.05);
  };

  return (
    <>
      {/* 모바일 전용 레이아웃 - 세로 스택 */}
      <div className="space-y-4 flex flex-col items-center w-full">
        {marketData.slice(0, renderedCount).map((market, index) => {
          const theme = getMarketTheme(market.name);
          const cardId = `card-${market.id}`;
          const cardOpacity = getCardOpacity(cardId, index);
          const cardScale = getCardScale(cardId, index);

          return (
          <React.Fragment key={market.id}>
            {/* 카드 컨테이너 - 뱃지를 위한 상대 위치 */}
            <div
              ref={(el) => setCardRef(el, cardId)}
              data-card-id={cardId}
              className="w-full mx-auto relative pt-4 transition-all duration-300 ease-out"
              style={{
                animation: navigationType !== 'POP' ? 'fadeInUp 0.3s ease-out forwards' : 'none',
                animationDelay: navigationType !== 'POP' ? `${index * 50}ms` : '0ms',
                opacity: cardOpacity,
                transform: `scale(${cardScale})`,
                filter: `blur(${(1 - cardOpacity) * 2}px)`
              }}
            >
              {/* 공판장명 뱃지 - 카드 위에 걸쳐있는 형태 (공판장별 단색 배경) */}
              <div className="absolute -top-0 left-4 z-10">
                <span
                  className="inline-flex items-center gap-2 px-4 py-2 text-white text-base font-bold rounded-full shadow-md"
                  style={{ backgroundColor: theme.badgeColor }}
                >
                  <span className="w-2.5 h-2.5 bg-white rounded-full"></span>
                  {market.name}
                </span>
              </div>

              {/* 카드 본체 - 그라데이션 배경 적용 */}
              <div
                className="rounded-2xl overflow-hidden shadow-md border border-gray-100 hover:shadow-lg transition-all duration-300 haptic-feedback no-select market-card cursor-pointer"
                style={{ background: theme.gradient }}
                onClick={() => handleCardClick(market.name)}
              >
              {/* 가격 정보 영역 */}
              <div className="px-0 py-2 pt-6">
              {market.error ? (
                <div className="text-center py-8">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">📊</span>
                    </div>
                    <div className="text-gray-500 text-base font-medium">경락가 정보가 없습니다</div>
                  </div>
                </div>
              ) : (
                <>
                  {/* 총 출하량 정보 */}
                  <div className="flex items-center justify-between text-base text-gray-600 mb-2">
                    <div>
                      총 출하량 <span className="font-bold text-gray-800">{formatPrice(market.totalQuantity)}{market.unit}</span>
                    </div>
                    <div>
                      {market.previousTotalQuantity ? (
                        renderPriceChange(market.totalQuantity, market.previousTotalQuantity, '상자')
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                  {/* 총 출하금액 정보 (DB에서 제공하는 실제 거래금액) */}
                  <div className="text-base text-gray-600 mb-4">
                    총 출하금액 <span className="font-bold text-gray-800">{formatPrice(market.totalAmount)}원</span>
                  </div>

                  {/* 가격 정보 그리드 - 3열 (평균가, 최고가, 최저가) + 각각 전일대비 */}
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {/* 평균가 */}
                    <div className="bg-white rounded-lg py-2 px-0.5 shadow-sm">
                      <div className="text-xs text-gray-500 mb-0.5">평균가</div>
                      <div className={`text-base font-bold ${theme.text}`}>
                        {formatPrice(market.averagePrice)}원
                      </div>
                      <div className="mt-0.5 min-h-[18px]">
                        {market.previousAveragePrice ? (
                          renderPriceChange(market.averagePrice, market.previousAveragePrice)
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </div>

                    {/* 최고가 */}
                    <div className="bg-white rounded-lg py-2 px-0.5 shadow-sm">
                      <div className="text-xs text-gray-500 mb-0.5">최고가</div>
                      <div className="text-base font-bold text-red-500">
                        {formatPrice(market.maxPrice)}원
                      </div>
                      <div className="mt-0.5 min-h-[18px]">
                        {market.previousMaxPrice ? (
                          renderPriceChange(market.maxPrice, market.previousMaxPrice)
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </div>

                    {/* 최저가 */}
                    <div className="bg-white rounded-lg py-2 px-0.5 shadow-sm">
                      <div className="text-xs text-gray-500 mb-0.5">최저가</div>
                      <div className="text-base font-bold text-blue-500">
                        {formatPrice(market.minPrice)}원
                      </div>
                      <div className="mt-0.5 min-h-[18px]">
                        {market.previousMinPrice ? (
                          renderPriceChange(market.minPrice, market.previousMinPrice)
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              {/* 액션 버튼 - 광고 카드 스타일과 일관성 */}
              <div className="mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(market.name);
                  }}
                  className={`w-full bg-gradient-to-r ${theme.bg} text-white font-semibold py-3 px-4 rounded-lg hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5`}
                >
                  상세 가격 보기
                </button>
              </div>
              </div>
            </div>
            </div>
            {/* 2개마다 광고 삽입 (2, 4, 6번째 카드 뒤) */}
            {shouldShowAds() && ((index + 1) % 2 === 0) && adsData && adsData.length > 0 && (
              <MobileAdDisplay
                ad={adsData[Math.floor(index / 2) % adsData.length]}
              />
            )}
          </React.Fragment>
          );
        })}

        {/* 최하단 광고 (경락 정보가 1개 이하일 때만 표시) */}
        {shouldShowAds() && adsData && adsData.length > 0 && marketData.length > 0 && marketData.length <= 1 && (
          <MobileAdDisplay
            ad={adsData[0]}
          />
        )}
      </div>
    </>
  );
};

export default MarketCards; 