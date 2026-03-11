import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import toast from 'react-hot-toast';
import { marketService, briefingService, adService } from '../services';
import { useAdminPermissions } from '../hooks/usePermissions';
import LoadingSpinner from '../components/LoadingSpinner';
import MobileAdDisplay from '../components/MobileAdDisplay';
import { shouldShowAds } from '../utils/deviceDetector';
import { sortAdsByPriority, getAdViewCounts } from '../utils/adPriority';
import { generatePriceDetailShareText, shareContent } from '../utils/shareUtils';

// 뱃지 색상 - 파랑으로 통일
const getMarketBadgeColor = () => {
  return '#1D4ED8'; // Blue-700
};

const Prices = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gradeSettings, setGradeSettings] = useState(null); // DB에서 가져온 등급 설정
  const [briefing, setBriefing] = useState(null); // AI 브리핑
  const [briefingGenerating, setBriefingGenerating] = useState(false); // 브리핑 생성 중
  const [auctionTime, setAuctionTime] = useState(null); // 경매시간
  const adminPermissions = useAdminPermissions();

  // URL 파라미터에서 시장명과 날짜 가져오기
  const marketName = searchParams.get('market');
  const urlDate = searchParams.get('date');
  const [selectedDate, setSelectedDate] = useState(
    urlDate || new Date().toISOString().split('T')[0]
  );

  // 설정 로드 상태
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // 광고 데이터 (모바일만)
  const { data: adsData } = useQuery({
    queryKey: ['ads', 'active', 'prices'],
    queryFn: () => adService.getActiveAds(),
    staleTime: 5 * 60 * 1000,
    enabled: shouldShowAds(),
  });
  const sortedAds = useMemo(() => {
    if (!adsData || adsData.length === 0) return [];
    return sortAdsByPriority(adsData, getAdViewCounts());
  }, [adsData]);

  // 페이지 진입 시 홈 캐시 무효화 플래그 세팅 (뒤로가기 시 홈이 신선한 데이터 로드)
  useEffect(() => {
    sessionStorage.setItem('home_cache_invalidate', 'true');
  }, []);

  // 페이지 진입 시 스크롤 최상단으로 이동 및 설정 로드
  useEffect(() => {
    window.scrollTo(0, 0);
    // DB에서 등급 정렬 설정 가져오기
    marketService.getMarketSettings().then(settings => {
      setGradeSettings(settings);
      setSettingsLoaded(true);
    }).catch(() => {
      setSettingsLoaded(true); // 에러가 나도 진행
    });
  }, []);

  // 등급 정렬 순서 적용 (공판장별 - DB 설정 사용)
  const sortDetailsByGradeOrder = (details, currentMarket, settings) => {
    if (!details) return details;

    // 전달받은 settings 또는 현재 gradeSettings 사용
    const currentSettings = settings || gradeSettings;

    // DB에서 가져온 공판장별 등급 순서 확인
    let orderArray = null;

    if (currentSettings?.grade_orders?.[currentMarket]) {
      orderArray = currentSettings.grade_orders[currentMarket];
    }

    // 공판장별 순서가 없으면 정렬하지 않음
    if (!orderArray) return details;

    return [...details].sort((a, b) => {
      const indexA = orderArray.indexOf(a.grade);
      const indexB = orderArray.indexOf(b.grade);
      // 목록에 없는 등급은 뒤로
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

  // 경락가 데이터 가져오기
  const fetchMarketData = async (market, date) => {
    try {
      setLoading(true);
      setError(null);

      if (!market) {
        throw new Error('시장명이 지정되지 않았습니다.');
      }

      const data = await marketService.getMarketDataWithComparison(market, date);

      // 등급 정렬 순서 적용 (공판장별)
      if (data && data.details) {
        data.details = sortDetailsByGradeOrder(data.details, market);
      }

      setMarketData(data);

    } catch (error) {
      console.error('Market data 조회 실패:', error);
      setError(error.message || '데이터를 불러올 수 없습니다.');
      setMarketData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 설정이 로드된 후에만 데이터 가져오기
    if (!settingsLoaded) return;

    if (marketName) {
      fetchMarketData(marketName, selectedDate);

      // 경매시간 조회
      marketService.getAuctionTime(marketName, selectedDate)
        .then(time => setAuctionTime(time))
        .catch(() => setAuctionTime(null));

      // 모든 공판장에서 브리핑 조회
      briefingService.getBriefing(marketName, selectedDate)
        .then(result => {
          if (result?.briefing) {
            setBriefing(result);
          } else {
            setBriefing(null);
          }
        })
        .catch(() => setBriefing(null));
    } else {
      setLoading(false);
      setError('시장을 선택해주세요.');
    }
  }, [marketName, selectedDate, settingsLoaded]);


  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    
    // URL 파라미터 업데이트
    const newParams = new URLSearchParams(searchParams);
    newParams.set('date', newDate);
    setSearchParams(newParams);
  };

  const handleRefresh = () => {
    if (marketName) {
      fetchMarketData(marketName, selectedDate);
    }
  };

  // 관리자 전용: 브리핑 생성
  const handleGenerateBriefing = async () => {
    if (!marketName || briefingGenerating) return;

    setBriefingGenerating(true);
    try {
      const result = await briefingService.generateBriefing(marketName, selectedDate);
      if (result.success) {
        setBriefing({ briefing: result.briefing, trend: result.trend });
        alert(`브리핑 생성 완료!\n\n"${result.briefing}"`);
      } else {
        alert(`브리핑 생성 실패: ${result.error}`);
      }
    } catch (error) {
      alert(`브리핑 생성 오류: ${error.message}`);
    } finally {
      setBriefingGenerating(false);
    }
  };

  const formatPrice = (price) => {
    return price ? price.toLocaleString('ko-KR') : '0';
  };

  // 브리핑 터치 시 공유 핸들러
  const handleShareBriefing = async () => {
    if (!marketData?.summary) return;

    const shareData = {
      name: marketName,
      averagePrice: marketData.summary.overall_avg_price,
      maxPrice: marketData.details?.[0]?.max_price || 0,
      minPrice: marketData.details?.[marketData.details.length - 1]?.min_price || 0,
      totalQuantity: marketData.summary.total_boxes,
      unit: '상자'
    };

    const text = generatePriceDetailShareText(
      shareData,
      selectedDate,
      briefing?.briefing
    );

    const result = await shareContent(`${marketName} 시세`, text);

    if (result.success && result.method === 'clipboard') {
      toast.success('시세 정보가 복사되었습니다');
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cloud-dancer">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto" />
          <p className="mt-4 text-gray-600">경락가격 정보를 불러오는 중...</p>
          {marketName && (
            <p className="text-sm text-gray-500 mt-2">{marketName} - {selectedDate}</p>
          )}
        </div>
      </div>
    );
  }

  if (error || !marketName) {
    return (
      <div className="min-h-screen bg-cloud-dancer pt-16 pb-24">
        <div className="w-full max-w-screen-xl mx-auto p-4">
          <div className="text-center py-12">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto">
              <div className="text-blue-600 mb-4">
                <HomeIcon className="w-12 h-12 mx-auto mb-3" />
              </div>
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                {!marketName ? '시장을 선택해주세요' : '데이터를 불러올 수 없습니다'}
              </h3>
              <p className="text-blue-600 text-sm mb-4">
                {!marketName 
                  ? '홈에서 원하는 시장의 경락카드를 클릭하여 가격 정보를 확인하세요.' 
                  : error
                }
              </p>
              <div className="space-y-2">
                <Link 
                  to="/"
                  className="btn btn-primary"
                >
                  홈으로 돌아가기
                </Link>
                {marketName && (
                  <button 
                    onClick={handleRefresh}
                    className="btn btn-outline"
                  >
                    다시 시도
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cloud-dancer pt-16 pb-24">
      {/* 헤더 */}
      <div className="bg-cloud-dancer shadow-sm border-b sticky top-14 z-10">
        <div className="w-full max-w-screen-xl mx-auto p-4">
          <div className="flex items-center justify-center relative">
            {/* 뒤로가기 버튼 */}
            <button
              onClick={() => navigate(-1)}
              className="absolute left-0 text-[#004225] text-2xl font-bold hover:opacity-70 transition-opacity"
              title="뒤로가기"
            >
              &lt;
            </button>

            {/* 날짜 중앙 정렬 */}
            <div className="flex items-center gap-2">
              <CalendarTodayIcon fontSize="small" className="text-[#004225]" />
              <span className="text-base font-medium text-gray-800">
                {formatDate(selectedDate)}
              </span>
            </div>

            {/* 단위 표시 */}
            <span className="absolute right-0 text-xs text-gray-500">
              단위 : 원
            </span>
          </div>
        </div>
      </div>

      {/* AI 브리핑 배너 - 모든 공판장 (터치 시 공유) */}
      {briefing?.briefing && (
        <div
          className="w-full max-w-screen-xl mx-auto px-4 pt-4"
          onClick={handleShareBriefing}
        >
          <div className="bg-white text-gray-700 rounded-xl px-4 py-3 border border-gray-200 shadow-sm cursor-pointer active:scale-[0.98] transition-transform">
            <p className="text-base leading-relaxed font-medium">{briefing.briefing}</p>
            <p className="text-xs text-gray-500 mt-1">터치하여 공유하기</p>
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="w-full max-w-screen-xl mx-auto p-4">
        {!marketData || !marketData.details || marketData.details.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                경락가 데이터가 없습니다
              </h3>
              <p className="text-yellow-600 text-sm mb-4">
                {formatDate(selectedDate)}에 <strong>{marketName}</strong>의 거래 데이터가 없습니다.
              </p>
              <div className="space-y-2 mb-4">
                <p className="text-yellow-600 text-xs">
                  • 주말이나 휴일에는 경매가 진행되지 않습니다
                </p>
                <p className="text-yellow-600 text-xs">
                  • 평일 오전 6시~오후 2시에 거래가 진행됩니다
                </p>
                <p className="text-yellow-600 text-xs">
                  • 계절에 따라 거래 품목이 달라질 수 있습니다
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      const newDate = new Date().toISOString().split('T')[0];
                      setSelectedDate(newDate);
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('date', newDate);
                      setSearchParams(newParams);
                    }}
                    className="btn btn-sm btn-outline border-[#004225] text-[#004225] hover:bg-[#004225] hover:text-white"
                  >
                    오늘 데이터 보기
                  </button>
                  <button
                    onClick={() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      const newDate = yesterday.toISOString().split('T')[0];
                      setSelectedDate(newDate);
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('date', newDate);
                      setSearchParams(newParams);
                    }}
                    className="btn btn-sm bg-[#004225] text-white hover:bg-[#003018] border-none"
                  >
                    어제 데이터 보기
                  </button>
                </div>
                <Link
                  to="/"
                  className="btn bg-[#004225] text-white hover:bg-[#003018] border-none"
                >
                  홈으로 돌아가기
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 요약 정보 - 카드 형태 */}
            {marketData.summary && (
              <div className="relative pt-4 mb-6">
                {/* 공판장명 뱃지 + 경매시간 */}
                <div className="absolute -top-0 left-4 right-4 z-10 flex items-center justify-between">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-sm font-bold rounded-full shadow-md"
                    style={{ backgroundColor: getMarketBadgeColor() }}
                  >
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                    {marketName}
                  </span>
                  {auctionTime && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white text-gray-700 text-sm font-semibold rounded-full shadow-md border border-gray-200">
                      <AccessTimeIcon style={{ fontSize: 16 }} />
                      {auctionTime} 경매
                    </span>
                  )}
                </div>

                {/* 카드 본체 */}
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 pt-6 pb-4 px-4">
                  {/* 날짜 정보 */}
                  <div className="text-xs text-gray-500 mb-3">
                    {formatDate(selectedDate)} 거래 요약
                  </div>

                  {/* 요약 정보 그리드 */}
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {/* 총 출하량 */}
                    <div className="bg-gray-50 rounded-lg py-3 px-1">
                      <div className="text-xs text-gray-500 mb-1">총 출하량</div>
                      <div className="text-base font-bold text-gray-800 whitespace-nowrap">
                        {formatPrice(marketData.summary.total_boxes)}상자
                      </div>
                    </div>

                    {/* 평균가 */}
                    <div className="bg-gray-50 rounded-lg py-3 px-1">
                      <div className="text-xs text-gray-500 mb-1">평균가</div>
                      <div className="text-base font-bold text-gray-900 whitespace-nowrap">
                        {formatPrice(marketData.summary.overall_avg_price)}
                      </div>
                    </div>

                    {/* 전일대비 */}
                    <div className="bg-gray-50 rounded-lg py-3 px-1">
                      <div className="text-xs text-gray-500 mb-1">전일대비</div>
                      <div className={`text-base font-bold whitespace-nowrap ${
                        !marketData.overall_comparison?.comparison_available ? 'text-gray-400' :
                        Math.abs(marketData.overall_comparison.changePercent) < 0.1 ? 'text-gray-600' :
                        marketData.overall_comparison.change > 0 ? 'text-red-500' : 'text-blue-500'
                      }`}>
                        {!marketData.overall_comparison?.comparison_available ? '-' :
                         Math.abs(marketData.overall_comparison.changePercent) < 0.1 ? '0' :
                         `${marketData.overall_comparison.change > 0 ? '▲' : '▼'} ${Math.abs(marketData.overall_comparison.change).toLocaleString()}`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 상세 가격 정보 - 카드 형태 */}
            <div className="space-y-6">
              {marketData.details.map((item, index) => {
                const priceComparison = item.price_comparison || {
                  change: 0,
                  changePercent: 0,
                  comparison_available: false
                };
                const boxesComparison = item.boxes_comparison || {
                  change: 0,
                  changePercent: 0,
                  comparison_available: false
                };

                return (
                  <div key={index} className="relative pt-4">
                    {/* 등급 뱃지 - 카드 위에 걸쳐있는 형태 (공판장별 색상 적용) */}
                    <div className="absolute -top-0 left-4 z-10">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-sm font-bold rounded-full shadow-md"
                        style={{ backgroundColor: getMarketBadgeColor() }}
                      >
                        <span className="w-2 h-2 bg-white rounded-full"></span>
                        {item.grade}
                      </span>
                    </div>

                    {/* 카드 본체 */}
                    <div className="bg-white rounded-2xl shadow-md border border-gray-100 pt-6 pb-4 px-4">
                      {/* 품목 정보 */}
                      <div className="text-base text-gray-600 mb-3 flex items-center gap-2">
                        <span>참외 {item.weight} · 수량 <span className="font-semibold text-gray-800">{formatPrice(item.boxes)}상자</span></span>
                        {boxesComparison.comparison_available && boxesComparison.change !== 0 && (
                          <span className={`text-base font-medium ${boxesComparison.change > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                            ({boxesComparison.change > 0 ? '+' : ''}{formatPrice(boxesComparison.change)})
                          </span>
                        )}
                      </div>

                      {/* 가격 정보 그리드 */}
                      <div className="grid grid-cols-4 gap-1 text-center">
                        {/* 평균가 */}
                        <div className="bg-gray-50 rounded-lg py-3 px-1">
                          <div className="text-xs text-gray-500 mb-1">평균가</div>
                          <div className="text-base font-bold text-gray-900 whitespace-nowrap">
                            {formatPrice(item.avg_price)}
                          </div>
                        </div>

                        {/* 전일대비 */}
                        <div className="bg-gray-50 rounded-lg py-3 px-1">
                          <div className="text-xs text-gray-500 mb-1">전일대비</div>
                          <div className={`text-base font-bold whitespace-nowrap ${
                            !priceComparison.comparison_available ? 'text-gray-400' :
                            Math.abs(priceComparison.changePercent) < 0.1 ? 'text-gray-600' :
                            priceComparison.change > 0 ? 'text-red-500' : 'text-blue-500'
                          }`}>
                            {!priceComparison.comparison_available ? '-' :
                             Math.abs(priceComparison.changePercent) < 0.1 ? '0' :
                             `${priceComparison.change > 0 ? '▲' : '▼'} ${Math.abs(priceComparison.change).toLocaleString()}`
                            }
                          </div>
                        </div>

                        {/* 최고가 */}
                        <div className="bg-gray-50 rounded-lg py-3 px-1">
                          <div className="text-xs text-gray-500 mb-1">최고가</div>
                          <div className="text-base font-bold text-red-500 whitespace-nowrap">
                            {formatPrice(item.max_price)}
                          </div>
                        </div>

                        {/* 최저가 */}
                        <div className="bg-gray-50 rounded-lg py-3 px-1">
                          <div className="text-xs text-gray-500 mb-1">최저가</div>
                          <div className="text-base font-bold text-blue-500 whitespace-nowrap">
                            {formatPrice(item.min_price)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </>
        )}
      </div>

      {/* 최하단 광고 */}
      {shouldShowAds() && sortedAds.length > 0 && (
        <div className="mt-4 px-4">
          <MobileAdDisplay ad={sortedAds[0]} />
        </div>
      )}

      {/* 관리자 전용 플로팅 버튼 - 브리핑 생성 (모든 공판장) */}
      {adminPermissions.isAdmin && (
        <button
          onClick={handleGenerateBriefing}
          disabled={briefingGenerating}
          className={`fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
            briefingGenerating
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#004225] hover:bg-[#003018] active:scale-95'
          }`}
          title="AI 브리핑 생성"
        >
          {briefingGenerating ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <AutoAwesomeIcon className="text-white" />
          )}
        </button>
      )}
    </div>
  );
};

export default Prices;