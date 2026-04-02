import { useState, useEffect, useMemo, useRef, useContext, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import toast from 'react-hot-toast';
import { marketService, briefingService, adService } from '../services';
import { useAdminPermissions } from '../hooks/usePermissions';
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import MobileAdDisplay from '../components/MobileAdDisplay';
import { shouldShowAds } from '../utils/deviceDetector';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { sortAdsByPriority, getAdViewCounts } from '../utils/adPriority';
import { generatePriceDetailShareText, shareContent } from '../utils/shareUtils';
import PriceDetailModal from '../components/PriceDetailModal';
import LocalMarketDetailModal from '../components/LocalMarketDetailModal';
import MarketSearchModal from '../components/MarketSearchModal';

// 산지 목록 — 이 외에는 모두 모달 지원 (도매시장)
// 성주 내부 산지 + 공판장 (도매시장 집계에서 제외되는 시장)
const SEONGJU_LOCAL_MARKETS = ['선남농협', '성주원예', '성주조공', '용암농협', '초전농협', '가락공판장', '대전공판장', '광주공판장', '구리공판장'];
// 디테일 데이터가 market_data_raw 테이블에 있는 시장 (산지 + 목포원예 등)
const RAW_DETAIL_MARKETS = [...SEONGJU_LOCAL_MARKETS, '목포원예농업협동조합', '경주농협 공판장', '제주시농협농산물공판장'];
const isWholesaleMarket = (name) => {
  if (!name) return false;
  return !SEONGJU_LOCAL_MARKETS.includes(name);
};

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
  const [selectedGrade, setSelectedGrade] = useState(null); // 도매시장 모달용 선택된 등급/법인명
  const [localSelectedGrade, setLocalSelectedGrade] = useState(null); // 산지(로컬마켓) 모달용 선택된 등급
  const [favorites, setFavorites] = useState([]); // 즐겨찾기 목록
  const [searchModalOpen, setSearchModalOpen] = useState(false); // 검색 모달
  const adminPermissions = useAdminPermissions();
  const { currentUser } = useContext(AuthContext);
  const scrollDirection = useScrollDirection();

  // URL 파라미터에서 시장명과 날짜 가져오기
  const marketName = searchParams.get('market');
  const urlDate = searchParams.get('date');
  const [selectedDate, setSelectedDate] = useState(
    urlDate || new Date().toISOString().split('T')[0]
  );

  // 날짜 선택 input ref
  const dateInputRef = useRef(null);

  // 설정 로드 ref (리렌더 방지)
  const gradeSettingsRef = useRef(null);

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

  // 로컬마켓일 때 raw 데이터 존재 여부 확인
  const isLocal = RAW_DETAIL_MARKETS.includes(marketName);
  const { data: hasRawData } = useQuery({
    queryKey: ['market-data-raw-exists', marketName, selectedDate],
    queryFn: () => marketService.checkMarketDataRawExists(marketName, selectedDate),
    enabled: !!marketName && isLocal,
    staleTime: 5 * 60 * 1000,
  });

  // 페이지 진입 시 홈 캐시 무효화 플래그 세팅 (뒤로가기 시 홈이 신선한 데이터 로드)
  useEffect(() => {
    sessionStorage.setItem('home_cache_invalidate', 'true');
  }, []);

  // 페이지 진입 시 스크롤 최상단으로 이동
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 즐겨찾기 목록 로드
  useEffect(() => {
    if (!currentUser) return;
    marketService.getFavorites().then(setFavorites).catch(() => {});
  }, [currentUser]);

  // 즐겨찾기 key 생성
  const getFavKey = useCallback((mName, weight, grade) => `${mName}__${weight}__${grade}`, []);

  // 즐겨찾기 Set (빠른 조회용)
  const favSet = useMemo(() => {
    const s = new Set();
    favorites.forEach(f => s.add(getFavKey(f.market_name, f.weight, f.grade)));
    return s;
  }, [favorites, getFavKey]);

  // 즐겨찾기 토글
  const handleToggleFavorite = useCallback(async (mName, weight, grade) => {
    if (!currentUser) {
      toast('회원 전용 기능입니다.\n로그인 후 이용해주세요.');
      return;
    }
    const key = getFavKey(mName, weight, grade);
    const existing = favorites.find(f => getFavKey(f.market_name, f.weight, f.grade) === key);

    try {
      if (existing) {
        await marketService.removeFromFavorites(existing.id);
        setFavorites(prev => prev.filter(f => f.id !== existing.id));
        toast('즐겨찾기가 해제되었습니다', { icon: '☆' });
      } else {
        const newFav = await marketService.addToFavorites({
          marketName: mName,
          itemName: '참외',
          weight,
          grade,
        });
        setFavorites(prev => [...prev, newFav]);
        toast('즐겨찾기에 추가되었습니다', { icon: '⭐' });
      }
    } catch (err) {
      toast.error('처리 중 오류가 발생했습니다');
    }
  }, [currentUser, favorites, getFavKey, navigate]);

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

  // 경락가 데이터 가져오기 (설정도 병렬 로드)
  const fetchMarketData = async (market, date) => {
    try {
      setLoading(true);
      setError(null);

      if (!market) {
        throw new Error('시장명이 지정되지 않았습니다.');
      }

      // 시세 데이터 + 등급 설정을 병렬로 가져오기
      const [data, settings] = await Promise.all([
        marketService.getMarketDataWithComparison(market, date),
        gradeSettingsRef.current
          ? Promise.resolve(gradeSettingsRef.current) // 이미 로드된 경우 재사용
          : marketService.getMarketSettings().catch(() => null),
      ]);

      // 설정 캐싱
      if (settings) {
        gradeSettingsRef.current = settings;
        setGradeSettings(settings);
      }

      // 등급 정렬 순서 적용 (공판장별)
      if (data && data.details) {
        data.details = sortDetailsByGradeOrder(data.details, market, settings);
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
  }, [marketName, selectedDate]);


  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);

    // URL 파라미터 업데이트 (replace: true로 history 쌓이지 않게)
    const newParams = new URLSearchParams(searchParams);
    newParams.set('date', newDate);
    setSearchParams(newParams, { replace: true });
  };

  const handlePrevDate = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    const newDate = prev.toISOString().split('T')[0];
    setSelectedDate(newDate);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('date', newDate);
    setSearchParams(newParams, { replace: true });
  };

  const handleNextDate = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    const today = new Date().toISOString().split('T')[0];
    const newDate = next.toISOString().split('T')[0];
    if (newDate > today) return;
    setSelectedDate(newDate);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('date', newDate);
    setSearchParams(newParams, { replace: true });
  };

  const isToday = selectedDate >= new Date().toISOString().split('T')[0];

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

  // 헤더용 짧은 날짜 포맷 (예: 3월 13일 (금))
  const formatDateShort = (dateStr) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${month}월 ${day}일 (${weekday})`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto" />
          <p className="mt-4 text-base-content/60">경락가격 정보를 불러오는 중...</p>
          {marketName && (
            <p className="text-base text-base-content/50 mt-2">{marketName} - {selectedDate}</p>
          )}
        </div>
      </div>
    );
  }

  if (error || !marketName) {
    return (
      <div className="min-h-screen bg-base-200 pt-16 pb-24">
        <div className="w-full max-w-screen-xl mx-auto p-4">
          <div className="text-center py-12">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto">
              <div className="text-blue-600 mb-4">
                <HomeIcon className="w-12 h-12 mx-auto mb-3" />
              </div>
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                {!marketName ? '시장을 선택해주세요' : '데이터를 불러올 수 없습니다'}
              </h3>
              <p className="text-blue-600 text-base mb-4">
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
    <div className="min-h-screen bg-base-200 pt-16 pb-24">
      {/* 헤더 */}
      <div className="bg-base-200 shadow-sm border-b sticky top-14 z-10">
        <div className="w-full max-w-screen-xl mx-auto p-4">
          <div className="flex items-center justify-between">
            {/* 뒤로가기 버튼 */}
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-base-300 rounded-full transition-colors active:scale-90 shrink-0"
              title="뒤로가기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
              </svg>
            </button>

            {/* 날짜 네비게이션 중앙 */}
            <div className="flex items-center gap-0.5 relative">
              {/* 이전 날짜 */}
              <button
                onClick={handlePrevDate}
                className="p-1 text-base-content hover:bg-base-200 rounded-full transition-colors active:scale-90"
                title="이전 날짜"
              >
                <ChevronLeftIcon fontSize="small" />
              </button>

              {/* 날짜 텍스트 (클릭 시 datepicker) */}
              <button
                onClick={() => dateInputRef.current?.showPicker?.()}
                className="flex items-center gap-1 px-1 py-1 rounded-lg hover:bg-base-200 transition-colors active:scale-95"
              >
                <CalendarTodayIcon style={{ fontSize: 14 }} className="text-base-content" />
                <span className="text-base font-medium text-base-content whitespace-nowrap">
                  {formatDateShort(selectedDate)}
                </span>
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                max={new Date().toISOString().split('T')[0]}
                className="absolute opacity-0 w-0 h-0 pointer-events-none"
                tabIndex={-1}
              />

              {/* 다음 날짜 */}
              <button
                onClick={handleNextDate}
                disabled={isToday}
                className={`p-1 rounded-full transition-colors active:scale-90 ${
                  isToday
                    ? 'text-base-content/30 cursor-not-allowed'
                    : 'text-base-content hover:bg-base-200'
                }`}
                title="다음 날짜"
              >
                <ChevronRightIcon fontSize="small" />
              </button>
            </div>

            {/* 단위 표시 */}
            <span className="text-sm text-base-content/50 shrink-0 whitespace-nowrap">
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
          <div className="bg-base-100 text-base-content/70 rounded-xl px-4 py-3 border border-base-300 shadow-sm cursor-pointer active:scale-[0.98] transition-transform">
            <p className="text-base leading-relaxed font-medium">{briefing.briefing}</p>
            <p className="text-sm text-base-content/50 mt-1">터치하여 공유하기</p>
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="w-full max-w-screen-xl mx-auto p-4">
        {!marketData || !marketData.details || marketData.details.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                경락가 데이터가 없습니다
              </h3>
              <p className="text-yellow-600 dark:text-yellow-400/80 text-base mb-4">
                {formatDate(selectedDate)}에 <strong>{marketName}</strong>의 거래 데이터가 없습니다.
              </p>
              <div className="space-y-2 mb-4">
                <p className="text-yellow-600 dark:text-yellow-400/70 text-sm">
                  • 주말이나 휴일에는 경매가 진행되지 않습니다
                </p>
                <p className="text-yellow-600 dark:text-yellow-400/70 text-sm">
                  • 평일 오전 6시~오후 2시에 거래가 진행됩니다
                </p>
                <p className="text-yellow-600 dark:text-yellow-400/70 text-sm">
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
                      setSearchParams(newParams, { replace: true });
                    }}
                    className="btn btn-sm btn-outline border-[#004225] text-[#004225] hover:bg-[#004225] hover:text-white dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-600 dark:hover:text-white"
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
                      setSearchParams(newParams, { replace: true });
                    }}
                    className="btn btn-sm bg-[#004225] text-white hover:bg-[#003018] border-none dark:bg-emerald-600 dark:hover:bg-emerald-700"
                  >
                    어제 데이터 보기
                  </button>
                </div>
                <Link
                  to="/"
                  className="btn bg-[#004225] text-white hover:bg-[#003018] border-none dark:bg-emerald-600 dark:hover:bg-emerald-700"
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-base font-bold rounded-full shadow-md"
                    style={{ backgroundColor: getMarketBadgeColor() }}
                  >
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                    {marketName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {auctionTime && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-base-100 text-base-content/70 text-base font-semibold rounded-full shadow-md border border-base-300">
                        <AccessTimeIcon style={{ fontSize: 16 }} />
                        {auctionTime} 경매
                      </span>
                    )}
                    {/* 즐겨찾기 ★ 버튼 (summary) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(marketName, 'all', 'summary');
                      }}
                      className="p-1.5 rounded-full shadow-md bg-base-100 border border-base-300 active:scale-90 transition-transform"
                      title="즐겨찾기"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill={favSet.has(getFavKey(marketName, 'all', 'summary')) ? '#f59e0b' : 'none'} stroke={favSet.has(getFavKey(marketName, 'all', 'summary')) ? '#f59e0b' : 'currentColor'} strokeWidth="2">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 카드 본체 */}
                <div className="bg-base-100 rounded-2xl shadow-md border border-base-200 pt-6 pb-4 px-4">
                  {/* 날짜 정보 */}
                  <div className="text-sm text-base-content/50 mb-3">
                    {formatDate(selectedDate)} 거래 요약
                  </div>

                  {/* 요약 정보 그리드 */}
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {/* 총 출하량 */}
                    <div className="bg-base-200 rounded-lg py-3 px-1">
                      <div className="text-sm text-base-content/50 mb-1">총 출하량</div>
                      <div className="text-lg font-bold text-base-content whitespace-nowrap">
                        {formatPrice(marketData.summary.total_boxes)}상자
                      </div>
                    </div>

                    {/* 전체 평균가 */}
                    <div className="bg-base-200 rounded-lg py-3 px-1">
                      <div className="text-sm text-base-content/50 mb-1">전체 평균가</div>
                      <div className="text-lg font-bold text-base-content whitespace-nowrap">
                        {formatPrice(marketData.summary.overall_avg_price)}
                      </div>
                    </div>

                    {/* 전일대비 */}
                    <div className="bg-base-200 rounded-lg py-3 px-1">
                      <div className="text-sm text-base-content/50 mb-1">전일대비</div>
                      <div className={`text-lg font-bold whitespace-nowrap ${
                        !marketData.overall_comparison?.comparison_available ? 'text-base-content/40' :
                        Math.abs(marketData.overall_comparison.changePercent) < 0.1 ? 'text-base-content/60' :
                        marketData.overall_comparison.change > 0 ? 'text-red-500' : 'text-blue-500'
                      }`}>
                        {!marketData.overall_comparison?.comparison_available ? '-' :
                         Math.abs(marketData.overall_comparison.changePercent) < 0.1 ? '보합' :
                         `${marketData.overall_comparison.change > 0 ? '▲' : '▼'} ${Math.abs(marketData.overall_comparison.change).toLocaleString()}`
                        }
                      </div>
                    </div>
                  </div>

                  {/* 전체 최고가 / 최저가 */}
                  {marketData.details && marketData.details.length > 0 && (
                    <div className="grid grid-cols-2 gap-1 text-center mt-1">
                      <div className="bg-base-200 rounded-lg py-3 px-1">
                        <div className="text-sm text-base-content/50 mb-1">전체 최고가</div>
                        <div className="text-lg font-bold text-red-500 whitespace-nowrap">
                          {formatPrice(Math.max(...marketData.details.map(d => d.max_price || 0)))}
                        </div>
                      </div>
                      <div className="bg-base-200 rounded-lg py-3 px-1">
                        <div className="text-sm text-base-content/50 mb-1">전체 최저가</div>
                        <div className="text-lg font-bold text-blue-500 whitespace-nowrap">
                          {formatPrice(Math.min(...marketData.details.map(d => d.min_price || 0).filter(p => p > 0)))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 상세 가격 정보 - 카드 형태 (10kg 필터) */}
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
                const isWholesale = isWholesaleMarket(marketName);
                const isLocalMarket = RAW_DETAIL_MARKETS.includes(marketName);
                const canShowDetail = isWholesale || (isLocalMarket && hasRawData);

                return (
                  <div
                    key={index}
                    className={`relative pt-4 ${canShowDetail ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
                    onClick={() => {
                      if (!canShowDetail) return;
                      if (isLocalMarket) setLocalSelectedGrade(item.grade);
                      else if (isWholesale) setSelectedGrade(item.grade);
                    }}
                  >
                    {/* 등급 뱃지 + 즐겨찾기 - 카드 위에 걸쳐있는 형태 */}
                    <div className="absolute -top-0 left-4 right-4 z-10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-base font-bold rounded-full shadow-md"
                          style={{ backgroundColor: getMarketBadgeColor() }}
                        >
                          <span className="w-2 h-2 bg-white rounded-full"></span>
                          {item.grade}
                        </span>
                        {canShowDetail && (
                          <span className="text-sm text-base-content/40">상세 보기 &gt;</span>
                        )}
                      </div>
                      {/* 즐겨찾기 ★ 버튼 (data) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(marketName, item.weight, item.grade);
                        }}
                        className="p-1.5 rounded-full shadow-md bg-base-100 border border-base-300 active:scale-90 transition-transform"
                        title="즐겨찾기"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill={favSet.has(getFavKey(marketName, item.weight, item.grade)) ? '#f59e0b' : 'none'} stroke={favSet.has(getFavKey(marketName, item.weight, item.grade)) ? '#f59e0b' : 'currentColor'} strokeWidth="2">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                    </div>

                    {/* 카드 본체 */}
                    <div className="bg-base-100 rounded-2xl shadow-md border border-base-200 pt-6 pb-4 px-4">
                      {/* 품목 정보 */}
                      <div className="text-base text-base-content/60 mb-3 flex items-center gap-2">
                        <span>참외 {item.weight} · 수량 <span className="font-semibold text-base-content">{formatPrice(item.boxes)}상자</span></span>
                        {boxesComparison.comparison_available && boxesComparison.change !== 0 && (
                          <span className={`text-base font-medium ${boxesComparison.change > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                            ({boxesComparison.change > 0 ? '+' : ''}{formatPrice(boxesComparison.change)})
                          </span>
                        )}
                      </div>

                      {/* 가격 정보 그리드 - 3컬럼 + 각 변동폭 */}
                      <div className="grid grid-cols-3 gap-1 text-center">
                        {/* 평균가 */}
                        <div className="bg-base-200 rounded-lg py-3 px-1">
                          <div className="text-sm text-base-content/50 mb-1">평균가</div>
                          <div className="text-lg font-bold text-base-content whitespace-nowrap">
                            {formatPrice(item.avg_price)}
                          </div>
                          <div className={`text-sm font-medium whitespace-nowrap mt-1 ${
                            !priceComparison.comparison_available ? 'text-base-content/30' :
                            Math.abs(priceComparison.changePercent) < 0.1 ? 'text-base-content/40' :
                            priceComparison.change > 0 ? 'text-red-500' : 'text-blue-500'
                          }`}>
                            {!priceComparison.comparison_available ? '-' :
                             Math.abs(priceComparison.changePercent) < 0.1 ? '보합' :
                             `${priceComparison.change > 0 ? '▲' : '▼'} ${Math.abs(priceComparison.change).toLocaleString()}`
                            }
                          </div>
                        </div>

                        {/* 최고가 */}
                        <div className="bg-base-200 rounded-lg py-3 px-1">
                          <div className="text-sm text-base-content/50 mb-1">최고가</div>
                          <div className="text-lg font-bold text-red-500 whitespace-nowrap">
                            {formatPrice(item.max_price)}
                          </div>
                          {(() => {
                            const mc = item.max_price_comparison || { comparison_available: false, change: 0, changePercent: 0 };
                            return (
                              <div className={`text-sm font-medium whitespace-nowrap mt-1 ${
                                !mc.comparison_available ? 'text-base-content/30' :
                                Math.abs(mc.changePercent) < 0.1 ? 'text-base-content/40' :
                                mc.change > 0 ? 'text-red-500' : 'text-blue-500'
                              }`}>
                                {!mc.comparison_available ? '-' :
                                 Math.abs(mc.changePercent) < 0.1 ? '보합' :
                                 `${mc.change > 0 ? '▲' : '▼'} ${Math.abs(mc.change).toLocaleString()}`
                                }
                              </div>
                            );
                          })()}
                        </div>

                        {/* 최저가 */}
                        <div className="bg-base-200 rounded-lg py-3 px-1">
                          <div className="text-sm text-base-content/50 mb-1">최저가</div>
                          <div className="text-lg font-bold text-blue-500 whitespace-nowrap">
                            {formatPrice(item.min_price)}
                          </div>
                          {(() => {
                            const mc = item.min_price_comparison || { comparison_available: false, change: 0, changePercent: 0 };
                            return (
                              <div className={`text-sm font-medium whitespace-nowrap mt-1 ${
                                !mc.comparison_available ? 'text-base-content/30' :
                                Math.abs(mc.changePercent) < 0.1 ? 'text-base-content/40' :
                                mc.change > 0 ? 'text-red-500' : 'text-blue-500'
                              }`}>
                                {!mc.comparison_available ? '-' :
                                 Math.abs(mc.changePercent) < 0.1 ? '보합' :
                                 `${mc.change > 0 ? '▲' : '▼'} ${Math.abs(mc.change).toLocaleString()}`
                                }
                              </div>
                            );
                          })()}
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

      {/* 도매시장 상세 모달 */}
      <PriceDetailModal
        isOpen={!!selectedGrade}
        onClose={() => setSelectedGrade(null)}
        marketName={marketName}
        marketDate={selectedDate}
        gradeName={selectedGrade}
      />

      {/* 산지(로컬마켓) 상세 모달 */}
      <LocalMarketDetailModal
        isOpen={!!localSelectedGrade}
        onClose={() => setLocalSelectedGrade(null)}
        marketName={marketName}
        marketDate={selectedDate}
        gradeName={localSelectedGrade}
      />

      {/* 플로팅 버튼: 오른쪽 세로 (검색 + 즐겨찾기), 왼쪽 (admin) */}
      {/* 검색 버튼 (오른쪽 하단) */}
      <button
        onClick={() => setSearchModalOpen(true)}
        className={`fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 bg-blue-600 hover:bg-blue-700 active:scale-95 ${
          scrollDirection === 'down' ? 'translate-x-20' : 'translate-x-0'
        }`}
        title="도매시장 법인 검색"
      >
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      {/* 즐겨찾기 버튼 (검색 위) */}
      <button
        onClick={() => {
          if (!currentUser) {
            toast('회원 전용 기능입니다.\n로그인 후 이용해주세요.');
            return;
          }
          navigate('/favorite-prices');
        }}
        className={`fixed bottom-[160px] right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 bg-amber-500 hover:bg-amber-600 active:scale-95 ${
          scrollDirection === 'down' ? 'translate-x-20' : 'translate-x-0'
        }`}
        title="즐겨찾기 시세"
      >
        <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </button>

      {/* 도매시장 검색 모달 */}
      <MarketSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        marketDate={selectedDate}
      />

      {/* 관리자 전용 플로팅 버튼 (왼쪽 하단) */}
      {adminPermissions.isAdmin && (
        <button
          onClick={handleGenerateBriefing}
          disabled={briefingGenerating}
          className={`fixed bottom-24 left-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
            briefingGenerating
              ? 'bg-base-300 cursor-not-allowed'
              : 'bg-[#004225] hover:bg-[#003018] active:scale-95'
          } ${scrollDirection === 'down' ? '-translate-x-20' : 'translate-x-0'}`}
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