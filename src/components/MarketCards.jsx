import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useNavigationType } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { adService } from '../services';
import MobileAdDisplay from './MobileAdDisplay';
import { shouldShowAds } from '../utils/deviceDetector';
import { generateMarketShareText, shareContent } from '../utils/shareUtils';
import { sortAdsByPriority, getAdViewCounts } from '../utils/adPriority';

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

// 도매시장 합계 카드에서 제외된 시장명 목록 (성주 내부 + 3대 외부 공판장)
const WHOLESALE_EXCLUDE_NAMES = [
  '선남농협', '성주원예', '성주조공', '용암농협', '초전농협',
  '가락공판장', '대전공판장', '광주공판장'
];

// 도매시장 합계 카드가 삽입될 기준점: 이 시장 카드 바로 뒤에 삽입
const WHOLESALE_TOTAL_INSERT_AFTER = '광주공판장';

const MarketCards = ({ marketData, seongjuTotal, wholesaleTotal, loading, selectedDate, formatPrice, formatDateForDisplay, handleRefresh, marketInfoMap }) => {
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  // 공판장 정보 바텀시트 상태
  const [infoSheet, setInfoSheet] = useState(null); // null | 공판장 info 객체
  const [revealedPhones, setRevealedPhones] = useState({}); // { index: true } 수송팀 번호 공개 여부

  // vCard 다운로드 (연락처 등록)
  const downloadVCard = (name, phone) => {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${phone}\nEND:VCARD`;
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 전화번호 마스킹 (010-1234-5678 → 010-****-5678)
  const maskPhone = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length >= 8) {
      return phone.replace(/(\d{2,4})[-\s]?(\d{3,4})[-\s]?(\d{4})/, '$1-****-$3');
    }
    return '****';
  };

  // 스크롤 페이드 인 효과
  const { visibleItems, observe, unobserve } = useScrollFadeIn();
  const cardRefs = useRef({});


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

  // 광고 우선순위 정렬 (마감임박, CTR, 로컬 노출빈도 반영)
  const sortedAds = useMemo(() => {
    if (!adsData || adsData.length === 0) return [];
    return sortAdsByPriority(adsData, getAdViewCounts());
  }, [adsData]);

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

  // 공판장 카드 통일 테마 (파랑 뱃지 + 파랑-녹색 그라데이션 버튼)
  const getMarketTheme = (isTotal = false, isWholesaleTotal = false) => {
    if (isWholesaleTotal) {
      // 도매시장 합계 카드는 보라-파랑 그라데이션 뱃지
      return {
        badgeGradient: 'linear-gradient(to right, #7C3AED, #1D4ED8)', // 보라 → 파랑 그라데이션
        text: 'text-[#7C3AED]',
        buttonGradient: 'from-[#7C3AED] to-[#1D4ED8]'
      };
    }
    if (isTotal) {
      // 성주군 합계 카드는 청록 그라데이션 뱃지
      return {
        badgeGradient: 'linear-gradient(to right, #1D4ED8, #16A34A)', // 청색 → 녹색 그라데이션
        text: 'text-[#1D4ED8]', // 파랑 텍스트
        buttonGradient: 'from-[#1D4ED8] to-[#16A34A]' // 파랑 → 녹색 그라데이션
      };
    }
    return {
      badgeColor: '#1D4ED8', // 파랑 (Blue-700)
      text: 'text-[#1D4ED8]', // 파랑 텍스트
      buttonGradient: 'from-[#1D4ED8] to-[#16A34A]' // 파랑 → 녹색 그라데이션
    };
  };

  // 등락 계산 및 표시 함수 (금액차만 표시, 중앙 정렬, 단위 없음)
  const renderPriceChange = (currentPrice, previousPrice) => {
    if (!previousPrice || previousPrice === 0) return null;

    const rawChange = currentPrice - previousPrice;
    // 원단위 이하 절사 (10원 단위로 내림)
    const change = Math.sign(rawChange) * Math.floor(Math.abs(rawChange) / 10) * 10;
    const isPositive = change > 0;

    if (change === 0) return <span className="text-base-content/50 text-sm">보합</span>;

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


  if (loading) {
    return (
      <div className="space-y-4 flex flex-col items-center w-full">
        {/* 스켈레톤 카드 1개 (CLS 방지: 최소 높이만 확보) */}
        <div className="w-full mx-auto relative pt-4 animate-pulse">
          {/* 뱃지 스켈레톤 */}
          <div className="absolute -top-0 left-4 right-4 z-10 flex items-center justify-between">
            <div className="h-9 w-28 bg-base-content/20 rounded-full"></div>
            <div className="w-9 h-9 bg-base-300 rounded-full"></div>
          </div>
          {/* 카드 본체 스켈레톤 */}
          <div className="rounded-2xl overflow-hidden shadow-md border border-base-200 bg-base-200">
            <div className="px-4 py-4 pt-8">
              {/* 출하량 */}
              <div className="flex items-center mb-2">
                <div className="h-5 w-16 bg-base-300 rounded"></div>
                <div className="h-6 w-20 bg-base-content/20 rounded ml-2"></div>
                <div className="h-4 w-8 bg-base-300 rounded ml-1"></div>
              </div>
              {/* 출하금액 */}
              <div className="flex items-center mb-4">
                <div className="h-5 w-20 bg-base-300 rounded"></div>
                <div className="h-5 w-32 bg-base-content/20 rounded ml-2"></div>
              </div>
              {/* 가격 3열 그리드 */}
              <div className="grid grid-cols-3 gap-1 text-center">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="bg-base-100 rounded-lg py-2 px-0.5 shadow-sm">
                    <div className="h-3 w-10 bg-base-300 rounded mx-auto mb-1"></div>
                    <div className="h-7 w-16 bg-base-content/20 rounded mx-auto"></div>
                    <div className="h-4 w-12 bg-base-300 rounded mx-auto mt-1"></div>
                  </div>
                ))}
              </div>
            </div>
            {/* 상세 버튼 스켈레톤 */}
            <div className="px-4 pb-4 pt-2">
              <div className="h-11 w-full bg-base-content/20 rounded-xl"></div>
            </div>
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
        {shouldShowAds() && sortedAds.length > 0 && (
          <div className="mt-4">
            <MobileAdDisplay
              ad={sortedAds[0]}
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

  // 합계 카드 공통 렌더링 함수 (성주군 합계 / 도매시장 합계 모두 사용)
  const renderTotalCard = (totalData, cardId, animationDelay = '0ms') => {
    if (!totalData) return null;

    const isWholesale = totalData.isWholesaleTotal === true;
    const theme = getMarketTheme(!isWholesale, isWholesale);
    // 성주군 합계: '성주군 합계', 도매시장 합계: '도매시장 합계' (URL 파라미터)
    const trendMarketParam = isWholesale ? '도매시장 합계' : '성주군 합계';

    return (
      <div
        ref={(el) => setCardRef(el, cardId)}
        data-card-id={cardId}
        className="w-full mx-auto relative pt-4 transition-all duration-300 ease-out"
        style={{
          animation: navigationType !== 'POP' ? `fadeInUp 0.3s ease-out ${animationDelay} forwards` : 'none'
        }}
      >
        {/* 합계 뱃지 - 그라데이션 + 추세 차트 아이콘 */}
        <div className="absolute -top-0 left-4 right-4 z-10 flex items-center justify-between">
          <span
            className="inline-flex items-center gap-2 px-4 py-2 text-white text-base font-bold rounded-full shadow-md"
            style={{ background: theme.badgeGradient }}
          >
            <span className="w-2.5 h-2.5 bg-white rounded-full"></span>
            {totalData.name}
          </span>
          {/* 추세 차트 아이콘 (성주군 합계 및 도매시장 합계 모두 표시) */}
          <button
            data-onboarding={isWholesale ? undefined : 'market-trend'}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/market-trend?market=${encodeURIComponent(trendMarketParam)}`);
            }}
            className="p-2 bg-base-100 rounded-full shadow-md hover:bg-base-200 active:scale-95 transition-all"
            title={`${totalData.name} 추세 보기`}
          >
            <ShowChartIcon style={{ fontSize: 20, color: isWholesale ? '#7C3AED' : '#1D4ED8' }} />
          </button>
        </div>

        {/* 카드 본체 */}
        <div className="rounded-2xl overflow-hidden shadow-md border border-base-200 bg-base-100 transition-all duration-300">
          <div className="px-4 py-4 pt-8">
            {/* 총 출하량 */}
            <div className="flex items-center text-base text-base-content/60 mb-2">
              <span>총 출하량</span>
              <span className="font-bold text-base-content text-lg ml-1">{formatPrice(totalData.totalQuantity)}</span>
              <span className="text-sm text-base-content/50 ml-1">{totalData.unit}</span>
              {totalData.previousTotalQuantity ? (
                <span className="ml-2">{renderPriceChange(totalData.totalQuantity, totalData.previousTotalQuantity)}</span>
              ) : null}
              {/* is_finalized가 false이면 '집계중' 표시 (당일만) */}
              {(() => {
                const koreanToday = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
                const isToday = selectedDate === koreanToday;
                if (isToday && !totalData.isFinalized) {
                  return <span className="ml-2 text-xs text-base-content/40">집계중</span>;
                }
                return null;
              })()}
            </div>
            {/* 총 출하금액 */}
            <div className="text-base text-base-content/60 mb-4">
              총 출하금액 <span className="font-bold text-base-content">{formatPrice(totalData.totalAmount)}</span> <span className="text-base-content/60">원</span>
            </div>

            {/* 가격 정보 그리드 - 3열 */}
            <div className="grid grid-cols-3 gap-1 text-center">
              <div className="bg-base-100 rounded-lg py-2 px-0.5 shadow-sm">
                <div className="text-xs text-base-content/50 mb-0.5">전체 평균가</div>
                <div className="text-xl font-bold text-base-content">
                  {formatPrice(totalData.averagePrice)}
                </div>
                <div className="mt-0.5 min-h-[20px]">
                  {totalData.previousAveragePrice ? (
                    renderPriceChange(totalData.averagePrice, totalData.previousAveragePrice)
                  ) : (
                    <span className="text-xs text-base-content/40">-</span>
                  )}
                </div>
              </div>
              <div className="bg-base-100 rounded-lg py-2 px-0.5 shadow-sm">
                <div className="text-xs text-base-content/50 mb-0.5">전체 최고가</div>
                <div className="text-xl font-bold text-red-600">
                  {formatPrice(totalData.maxPrice)}
                </div>
                <div className="mt-0.5 min-h-[20px]">
                  {totalData.previousMaxPrice ? (
                    renderPriceChange(totalData.maxPrice, totalData.previousMaxPrice)
                  ) : (
                    <span className="text-xs text-base-content/40">-</span>
                  )}
                </div>
              </div>
              <div className="bg-base-100 rounded-lg py-2 px-0.5 shadow-sm">
                <div className="text-xs text-base-content/50 mb-0.5">전체 최저가</div>
                <div className="text-xl font-bold text-blue-600">
                  {formatPrice(totalData.minPrice)}
                </div>
                <div className="mt-0.5 min-h-[20px]">
                  {totalData.previousMinPrice ? (
                    renderPriceChange(totalData.minPrice, totalData.previousMinPrice)
                  ) : (
                    <span className="text-xs text-base-content/40">-</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 성주군 합계 카드 렌더링 (renderTotalCard 위임)
  const renderSeongjuTotalCard = () => renderTotalCard(seongjuTotal, 'card-seongju-total');

  // 도매시장 합계 카드 렌더링 (renderTotalCard 위임)
  const renderWholesaleTotalCard = (animIndex) =>
    renderTotalCard(wholesaleTotal, 'card-wholesale-total', `${animIndex * 50}ms`);

  return (
    <>
      {/* 모바일 전용 레이아웃 - 세로 스택 */}
      <div className="space-y-4 flex flex-col items-center w-full">
        {/* 성주군 합계 카드 - 최상단 */}
        {renderSeongjuTotalCard()}

        {marketData.map((market, index) => {
          const theme = getMarketTheme(market.isTotal);
          const cardId = `card-${market.id}`;
          const cardTranslateY = getCardTranslateY(cardId, index);
          const cardScale = getCardScale(cardId, index);

          // 광주공판장 카드 바로 뒤에 도매시장 합계 카드 삽입 여부 결정
          const insertWholesaleAfter = market.name === WHOLESALE_TOTAL_INSERT_AFTER && wholesaleTotal;

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
              {/* 공판장명 뱃지 - 파랑 (터치 시 공유) + 정보 아이콘 + 추세 차트 아이콘 */}
              <div className="absolute -top-0 left-4 right-4 z-10 flex items-center justify-between">
                {/* 왼쪽: 공판장명 뱃지 + ℹ️ 버튼 */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-2 px-4 py-2 text-white text-base font-bold rounded-full shadow-md cursor-pointer active:scale-95 transition-transform"
                    style={{ backgroundColor: theme.badgeColor }}
                    onClick={(e) => handleShareMarket(market, e)}
                  >
                    <span className="w-2.5 h-2.5 bg-white rounded-full"></span>
                    {market.name}
                  </span>
                  {/* 공판장 정보 버튼 - marketInfoMap에 해당 시장 정보가 있을 때만 표시 */}
                  {marketInfoMap?.has(market.name) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInfoSheet(marketInfoMap.get(market.name));
                      }}
                      className="active:scale-95 transition-all"
                      title="공판장 정보 보기"
                    >
                      <svg className="w-8 h-8" style={{ color: theme.badgeColor }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
                {/* 추세 차트 아이콘 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/market-trend?market=${encodeURIComponent(market.name)}`);
                  }}
                  className="p-2 bg-base-100 rounded-full shadow-md hover:bg-base-200 active:scale-95 transition-all"
                  title="경락가 추세 보기"
                >
                  <ShowChartIcon style={{ fontSize: 20, color: theme.badgeColor }} />
                </button>
              </div>

              {/* 카드 본체 - base-100 배경 */}
              <div
                className="rounded-2xl overflow-hidden shadow-md border border-base-200 bg-base-100 hover:shadow-lg transition-all duration-300 haptic-feedback no-select market-card cursor-pointer"
                onClick={() => handleCardClick(market.name)}
              >
              {/* 가격 정보 영역 */}
              <div className="px-0 py-2 pt-6">
              {market.error ? (
                <div className="text-center py-8">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center">
                      <span className="text-2xl">📊</span>
                    </div>
                    <div className="text-base-content/50 text-base font-medium">경락가 정보가 없습니다</div>
                  </div>
                </div>
              ) : (
                <>
                  {/* 총 출하량 정보 */}
                  <div className="flex items-center text-base text-base-content/60 mb-2">
                    <span>총 출하량</span>
                    <span className="font-bold text-base-content text-lg ml-1">{formatPrice(market.totalQuantity)}</span>
                    <span className="text-sm text-base-content/50 ml-1">{market.unit}</span>
                    {/* 수량 변동폭 */}
                    {market.previousTotalQuantity ? (
                      <span className="ml-2">{renderPriceChange(market.totalQuantity, market.previousTotalQuantity)}</span>
                    ) : null}
                    {/* is_finalized가 false이면 '집계중' 표시 (당일만) */}
                    {(() => {
                      const koreanToday = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
                      const isToday = selectedDate === koreanToday;
                      if (isToday && !market.isFinalized) {
                        return <span className="ml-2 text-xs text-base-content/40">집계중</span>;
                      }
                      return null;
                    })()}
                  </div>
                  {/* 총 출하금액 정보 (DB에서 제공하는 실제 거래금액) */}
                  <div className="text-base text-base-content/60 mb-4">
                    총 출하금액 <span className="font-bold text-base-content">{formatPrice(market.totalAmount)}</span> <span className="text-base-content/60">원</span>
                  </div>

                  {/* 가격 정보 그리드 - 3열 (평균가, 최고가, 최저가) + 각각 전일대비 */}
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {/* 평균가 */}
                    <div className="bg-base-100 rounded-lg py-2 px-0.5 shadow-sm">
                      <div className="text-xs text-base-content/50 mb-0.5">전체 평균가</div>
                      <div className="text-xl font-bold text-base-content">
                        {formatPrice(market.averagePrice)}
                      </div>
                      <div className="mt-0.5 min-h-[20px]">
                        {market.previousAveragePrice ? (
                          renderPriceChange(market.averagePrice, market.previousAveragePrice)
                        ) : (
                          <span className="text-xs text-base-content/40">-</span>
                        )}
                      </div>
                    </div>

                    {/* 최고가 */}
                    <div className="bg-base-100 rounded-lg py-2 px-0.5 shadow-sm">
                      <div className="text-xs text-base-content/50 mb-0.5">전체 최고가</div>
                      <div className="text-xl font-bold text-red-600">
                        {formatPrice(market.maxPrice)}
                      </div>
                      <div className="mt-0.5 min-h-[20px]">
                        {market.previousMaxPrice ? (
                          renderPriceChange(market.maxPrice, market.previousMaxPrice)
                        ) : (
                          <span className="text-xs text-base-content/40">-</span>
                        )}
                      </div>
                    </div>

                    {/* 최저가 */}
                    <div className="bg-base-100 rounded-lg py-2 px-0.5 shadow-sm">
                      <div className="text-xs text-base-content/50 mb-0.5">전체 최저가</div>
                      <div className="text-xl font-bold text-blue-600">
                        {formatPrice(market.minPrice)}
                      </div>
                      <div className="mt-0.5 min-h-[20px]">
                        {market.previousMinPrice ? (
                          renderPriceChange(market.minPrice, market.previousMinPrice)
                        ) : (
                          <span className="text-xs text-base-content/40">-</span>
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
            {/* 광주공판장 뒤에 도매시장 합계 카드 삽입 */}
            {insertWholesaleAfter && renderWholesaleTotalCard(index + 1)}
            {/* 4개마다 광고 삽입 (4, 8, 12번째 카드 뒤) */}
            {shouldShowAds() && ((index + 1) % 4 === 0) && sortedAds.length > 0 && (
              <MobileAdDisplay
                ad={sortedAds[Math.floor(index / 4) % sortedAds.length]}
              />
            )}
          </React.Fragment>
          );
        })}

        {/* 광주공판장이 목록에 없을 때 도매시장 합계 카드 fallback: 목록 맨 끝에 표시 */}
        {wholesaleTotal && !marketData.some((m) => m.name === WHOLESALE_TOTAL_INSERT_AFTER) && (
          renderWholesaleTotalCard(marketData.length)
        )}

        {/* 최하단 광고 (경락 정보가 4개 미만일 때만 표시) */}
        {shouldShowAds() && sortedAds.length > 0 && marketData.length > 0 && marketData.length < 4 && (
          <MobileAdDisplay
            ad={sortedAds[0]}
          />
        )}
      </div>

      {/* 공판장 정보 모달 (중앙) */}
      {infoSheet && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-5"
            onClick={() => { setInfoSheet(null); setRevealedPhones({}); }}
          >
            <div
              className="bg-base-100 rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto w-full max-w-sm animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 헤더 - 그라데이션 배경 */}
              <div className="flex items-center justify-between px-6 py-4 rounded-t-2xl bg-gradient-to-r from-[#1D4ED8] to-[#16A34A]">
                <h3 className="text-xl font-bold text-white">{infoSheet.market_name}</h3>
                <button
                  onClick={() => { setInfoSheet(null); setRevealedPhones({}); }}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* 정보 목록 */}
              <div className="px-6 py-5 space-y-5">
                {/* 경매시간 */}
                {infoSheet.auction_hours && (
                  <div className="flex items-start gap-3">
                    <svg className="w-7 h-7 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm text-base-content/50 mb-0.5">경매시간</p>
                      <p className="text-lg font-semibold text-base-content">{infoSheet.auction_hours}</p>
                    </div>
                  </div>
                )}
                {/* 주소 */}
                {infoSheet.address && (
                  <div className="flex items-start gap-3">
                    <svg className="w-7 h-7 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div>
                      <p className="text-sm text-base-content/50 mb-0.5">주소</p>
                      <p className="text-lg font-semibold text-base-content">{infoSheet.address}</p>
                    </div>
                  </div>
                )}
                {/* 공판장 연락처 (바로 표시) */}
                {infoSheet.phone && (
                  <div className="flex items-start gap-3">
                    <svg className="w-7 h-7 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <div>
                      <p className="text-sm text-base-content/50 mb-0.5">공판장 연락처</p>
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${infoSheet.phone}`}
                          className="text-lg font-semibold text-blue-600 underline underline-offset-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {infoSheet.phone}
                        </a>
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadVCard(`${infoSheet.market_name}`, infoSheet.phone); }}
                          className="text-base-content/40 hover:text-base-content/70 transition-colors"
                          title="연락처 저장"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              {/* 수송팀 연락처 (여러 팀, 기본 숨김 → 터치 시 공개) */}
              {infoSheet.transport_teams && infoSheet.transport_teams.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <svg className="w-7 h-7 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                    </svg>
                    <p className="text-sm text-base-content/50">수송팀 연락처</p>
                  </div>
                  <div className="ml-10 space-y-2">
                    {infoSheet.transport_teams.map((team, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-base-200/50 rounded-lg px-3 py-2.5">
                        <div>
                          <p className="text-base text-base-content/50">{team.name || `수송팀 ${idx + 1}`}</p>
                          {revealedPhones[idx] ? (
                            <div className="flex items-center gap-2 mt-0.5">
                              <a
                                href={`tel:${team.phone}`}
                                className="text-lg font-semibold text-blue-600 underline underline-offset-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {team.phone}
                              </a>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadVCard(`${infoSheet.market_name} ${team.name || '수송팀'}`, team.phone);
                                }}
                                className="text-base-content/40 hover:text-base-content/70 transition-colors"
                                title="연락처 저장"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRevealedPhones(prev => ({ ...prev, [idx]: true }));
                              }}
                              className="text-lg text-base-content/40 mt-0.5 flex items-center gap-1"
                            >
                              <span>{maskPhone(team.phone)}</span>
                              <span className="text-sm text-blue-500">보기</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 메모 */}
              {infoSheet.memo && (
                <div className="flex items-start gap-3">
                  <svg className="w-7 h-7 text-base-content/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="text-sm text-base-content/50 mb-0.5">메모</p>
                    <p className="text-lg text-base-content/80 whitespace-pre-wrap">{infoSheet.memo}</p>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
      )}
    </>
  );
};

export default MarketCards; 