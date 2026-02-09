import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useNavigationType } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { adService } from '../services';
import MobileAdDisplay from './MobileAdDisplay';
import LoadingSpinner from './LoadingSpinner';
import { shouldShowAds } from '../utils/deviceDetector';
import { generateMarketShareText, shareContent } from '../utils/shareUtils';

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

const MarketCards = ({ marketData, seongjuTotal, loading, selectedDate, formatPrice, formatDateForDisplay, handleRefresh }) => {
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

  // 공판장 뱃지 터치 시 공유 핸들러
  const handleShareMarket = async (market, e) => {
    e.stopPropagation();
    const text = generateMarketShareText(market, selectedDate);
    const result = await shareContent(`${market.name} 시세`, text);

    if (result.success && result.method === 'clipboard') {
      toast.success('시세 정보가 복사되었습니다');
    }
  };

  // 공판장 카드 통일 테마 (파랑 뱃지 + 흰색 배경 + 파랑-녹색 그라데이션 버튼)
  const getMarketTheme = (isTotal = false) => {
    if (isTotal) {
      // 성주군 합계 카드는 청록 그라데이션 뱃지
      return {
        badgeGradient: 'linear-gradient(to right, #1D4ED8, #16A34A)', // 청색 → 녹색 그라데이션
        text: 'text-[#1D4ED8]', // 파랑 텍스트
        buttonGradient: 'from-[#1D4ED8] to-[#16A34A]', // 파랑 → 녹색 그라데이션
        cardBackground: '#F7F7F7' // cloud-dancer 배경
      };
    }
    return {
      badgeColor: '#1D4ED8', // 파랑 (Blue-700)
      text: 'text-[#1D4ED8]', // 파랑 텍스트
      buttonGradient: 'from-[#1D4ED8] to-[#16A34A]', // 파랑 → 녹색 그라데이션
      cardBackground: '#FFFFFF' // 흰색 배경
    };
  };

  // 등락 계산 및 표시 함수 (금액차만 표시, 중앙 정렬, 단위 없음)
  const renderPriceChange = (currentPrice, previousPrice) => {
    if (!previousPrice || previousPrice === 0) return null;

    const change = currentPrice - previousPrice;
    const isPositive = change > 0;

    if (change === 0) return <span className="text-gray-500 text-sm">보합</span>;

    return (
      <div className="flex items-center justify-center space-x-1 text-sm">
        <span className={isPositive ? 'text-red-600' : 'text-blue-600'}>
          {isPositive ? '▲' : '▼'}
        </span>
        <span className={`font-bold ${isPositive ? 'text-red-600' : 'text-blue-600'}`}>
          {Math.abs(change).toLocaleString()}
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
      <div className="flex items-start justify-center min-h-[calc(100vh-120px)] pt-32 bg-cloud-dancer">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto" />
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
          <div className="bg-gradient-to-br from-blue-500 to-green-500 rounded-2xl p-8 max-w-md mx-auto shadow-[0_0_40px_rgba(59,130,246,0.5)]">
            <div className="mb-4">
              <img
                src="/logo.svg"
                alt="참외이야기 로고"
                className="w-24 h-24 mx-auto brightness-0 invert"
              />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">경락가 정보가 없습니다</h3>
            <p className="text-sm text-white/80">아직 데이터가 업데이트 되지 않았거나 경매가 없습니다.</p>
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

  // 카드 등장 애니메이션용 Y offset 계산
  const getCardTranslateY = (cardId, index) => {
    const ratio = visibleItems[cardId];
    if (ratio === undefined) {
      // 아직 관찰되지 않은 카드는 살짝 아래에서 시작
      return index === 0 ? 0 : 20;
    }
    // 화면에 보이면 제자리로 (0px)
    return Math.max(0, (1 - ratio) * 20);
  };

  // 카드 스케일 계산 (화면 중앙에 가까울수록 크게)
  const getCardScale = (cardId, index) => {
    const ratio = visibleItems[cardId];
    if (ratio === undefined) {
      return index === 0 ? 1 : 0.96;
    }
    // 최소 0.96, 최대 1의 스케일
    return 0.96 + (ratio * 0.04);
  };

  // 성주군 합계 카드 렌더링 함수
  const renderSeongjuTotalCard = () => {
    if (!seongjuTotal) return null;

    const theme = getMarketTheme(true);
    const cardId = 'card-seongju-total';

    return (
      <div
        ref={(el) => setCardRef(el, cardId)}
        data-card-id={cardId}
        className="w-full mx-auto relative pt-4 transition-all duration-300 ease-out"
        style={{
          animation: navigationType !== 'POP' ? 'fadeInUp 0.3s ease-out forwards' : 'none'
        }}
      >
        {/* 성주군 합계 뱃지 - 청록 그라데이션 + 추세 차트 아이콘 */}
        <div className="absolute -top-0 left-4 right-4 z-10 flex items-center justify-between">
          <span
            className="inline-flex items-center gap-2 px-4 py-2 text-white text-base font-bold rounded-full shadow-md"
            style={{ background: theme.badgeGradient }}
          >
            <span className="w-2.5 h-2.5 bg-white rounded-full"></span>
            {seongjuTotal.name}
          </span>
          {/* 추세 차트 아이콘 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/market-trend?market=${encodeURIComponent('성주군 합계')}`);
            }}
            className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 active:scale-95 transition-all"
            title="성주군 합계 추세 보기"
          >
            <ShowChartIcon style={{ fontSize: 20, color: '#1D4ED8' }} />
          </button>
        </div>

        {/* 카드 본체 - 흰색 배경 (개별 공판장과 동일) */}
        <div
          className="rounded-2xl overflow-hidden shadow-md border border-gray-100 transition-all duration-300"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          {/* 가격 정보 영역 - 개별 공판장과 동일한 패딩 */}
          <div className="px-4 py-4 pt-8">
            {/* 총 출하량 정보 */}
            <div className="flex items-center text-base text-gray-600 mb-2">
              <span>총 출하량</span>
              <span className="font-bold text-gray-800 text-lg ml-1">{formatPrice(seongjuTotal.totalQuantity)}</span>
              <span className="text-sm text-gray-500 ml-1">{seongjuTotal.unit}</span>
              {/* 수량 변동폭은 17시 이후에만 표시, 그 전에는 '집계중' */}
              {new Date().getHours() >= 17 && seongjuTotal.previousTotalQuantity ? (
                <span className="ml-2">{renderPriceChange(seongjuTotal.totalQuantity, seongjuTotal.previousTotalQuantity)}</span>
              ) : (
                <span className="ml-2 text-xs text-gray-400">집계중</span>
              )}
            </div>
            {/* 총 출하금액 정보 */}
            <div className="text-base text-gray-600 mb-4">
              총 출하금액 <span className="font-bold text-gray-800">{formatPrice(seongjuTotal.totalAmount)}</span> <span className="text-gray-600">원</span>
            </div>

            {/* 가격 정보 그리드 - 3열 */}
            <div className="grid grid-cols-3 gap-1 text-center">
              {/* 평균가 */}
              <div className="bg-white rounded-lg py-2 px-0.5 shadow-sm">
                <div className="text-xs text-gray-500 mb-0.5">평균가</div>
                <div className="text-xl font-bold text-gray-900">
                  {formatPrice(seongjuTotal.averagePrice)}
                </div>
                <div className="mt-0.5 min-h-[20px]">
                  {seongjuTotal.previousAveragePrice ? (
                    renderPriceChange(seongjuTotal.averagePrice, seongjuTotal.previousAveragePrice)
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </div>
              </div>

              {/* 최고가 */}
              <div className="bg-white rounded-lg py-2 px-0.5 shadow-sm">
                <div className="text-xs text-gray-500 mb-0.5">최고가</div>
                <div className="text-xl font-bold text-red-600">
                  {formatPrice(seongjuTotal.maxPrice)}
                </div>
                <div className="mt-0.5 min-h-[20px]">
                  {seongjuTotal.previousMaxPrice ? (
                    renderPriceChange(seongjuTotal.maxPrice, seongjuTotal.previousMaxPrice)
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </div>
              </div>

              {/* 최저가 */}
              <div className="bg-white rounded-lg py-2 px-0.5 shadow-sm">
                <div className="text-xs text-gray-500 mb-0.5">최저가</div>
                <div className="text-xl font-bold text-blue-600">
                  {formatPrice(seongjuTotal.minPrice)}
                </div>
                <div className="mt-0.5 min-h-[20px]">
                  {seongjuTotal.previousMinPrice ? (
                    renderPriceChange(seongjuTotal.minPrice, seongjuTotal.previousMinPrice)
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 모바일 전용 레이아웃 - 세로 스택 */}
      <div className="space-y-4 flex flex-col items-center w-full">
        {/* 성주군 합계 카드 - 최상단 */}
        {renderSeongjuTotalCard()}

        {marketData.slice(0, renderedCount).map((market, index) => {
          const theme = getMarketTheme(market.isTotal);
          const cardId = `card-${market.id}`;
          const cardTranslateY = getCardTranslateY(cardId, index);
          const cardScale = getCardScale(cardId, index);

          return (
          <React.Fragment key={market.id}>
            {/* 카드 컨테이너 - 뱃지를 위한 상대 위치 */}
            <div
              ref={(el) => setCardRef(el, cardId)}
              data-card-id={cardId}
              className="w-full mx-auto relative pt-4 transition-all duration-300 ease-out"
              style={{
                animation: navigationType !== 'POP' ? `fadeInUp 0.3s ease-out ${index * 50}ms forwards` : 'none',
                transform: `scale(${cardScale}) translateY(${cardTranslateY}px)`
              }}
            >
              {/* 공판장명 뱃지 - 파랑 (터치 시 공유) + 추세 차트 아이콘 */}
              <div className="absolute -top-0 left-4 right-4 z-10 flex items-center justify-between">
                <span
                  className="inline-flex items-center gap-2 px-4 py-2 text-white text-base font-bold rounded-full shadow-md cursor-pointer active:scale-95 transition-transform"
                  style={{ backgroundColor: theme.badgeColor }}
                  onClick={(e) => handleShareMarket(market, e)}
                >
                  <span className="w-2.5 h-2.5 bg-white rounded-full"></span>
                  {market.name}
                </span>
                {/* 추세 차트 아이콘 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/market-trend?market=${encodeURIComponent(market.name)}`);
                  }}
                  className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 active:scale-95 transition-all"
                  title="경락가 추세 보기"
                >
                  <ShowChartIcon style={{ fontSize: 20, color: theme.badgeColor }} />
                </button>
              </div>

              {/* 카드 본체 - 흰색 배경 */}
              <div
                className="rounded-2xl overflow-hidden shadow-md border border-gray-100 hover:shadow-lg transition-all duration-300 haptic-feedback no-select market-card cursor-pointer"
                style={{ backgroundColor: theme.cardBackground }}
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
                  <div className="flex items-center text-base text-gray-600 mb-2">
                    <span>총 출하량</span>
                    <span className="font-bold text-gray-800 text-lg ml-1">{formatPrice(market.totalQuantity)}</span>
                    <span className="text-sm text-gray-500 ml-1">{market.unit}</span>
                    {market.previousTotalQuantity ? (
                      <span className="ml-2">{renderPriceChange(market.totalQuantity, market.previousTotalQuantity)}</span>
                    ) : null}
                  </div>
                  {/* 총 출하금액 정보 (DB에서 제공하는 실제 거래금액) */}
                  <div className="text-base text-gray-600 mb-4">
                    총 출하금액 <span className="font-bold text-gray-800">{formatPrice(market.totalAmount)}</span> <span className="text-gray-600">원</span>
                  </div>

                  {/* 가격 정보 그리드 - 3열 (평균가, 최고가, 최저가) + 각각 전일대비 */}
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {/* 평균가 */}
                    <div className="bg-white rounded-lg py-2 px-0.5 shadow-sm">
                      <div className="text-xs text-gray-500 mb-0.5">평균가</div>
                      <div className="text-xl font-bold text-gray-900">
                        {formatPrice(market.averagePrice)}
                      </div>
                      <div className="mt-0.5 min-h-[20px]">
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
                      <div className="text-xl font-bold text-red-600">
                        {formatPrice(market.maxPrice)}
                      </div>
                      <div className="mt-0.5 min-h-[20px]">
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
                      <div className="text-xl font-bold text-blue-600">
                        {formatPrice(market.minPrice)}
                      </div>
                      <div className="mt-0.5 min-h-[20px]">
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
              
              {/* 액션 버튼 - 파랑-녹색 그라데이션 */}
              <div className="mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(market.name);
                  }}
                  className={`w-full bg-gradient-to-r ${theme.buttonGradient} text-white font-semibold py-3 px-4 rounded-lg hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5`}
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