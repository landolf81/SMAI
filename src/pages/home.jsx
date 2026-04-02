import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';
import StoreIcon from '@mui/icons-material/Store';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SearchIcon from '@mui/icons-material/Search';
import { marketService, weatherBriefingService, postService } from '../services';
import weatherService from '../services/weatherService';
import MarketCards from '../components/MarketCards';
import DatePickerModal from '../components/DatePickerModal';
import LoadingSpinner from '../components/LoadingSpinner';
import WeatherWidget from '../components/WeatherWidget';
import WeatherModal from '../components/WeatherModal';
import EnhancedInstagramPost from '../components/EnhancedInstagramPost';
import { isMobileDevice, isTabletDevice, isDesktopDevice } from '../utils/deviceDetector';
import { useScrollRestore } from '../hooks/useScrollRestore';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useAdminPermissions } from '../hooks/usePermissions';
import PushNotificationBanner from '../components/PushNotificationBanner';
import MarketSearchModal from '../components/MarketSearchModal';
import CombinedMarketCard from '../components/CombinedMarketCard';


// 색상 정의
const COLORS = {
  mainGreen: '#154734',      // PANTONE 3435 C
  lightGreen: '#6CC24A',     // 농협 라이트 그린
  pointYellow: '#FFD400',    // 포인트 노랑
  neutralBg: '#F7F7F7',      // 중립 배경
  border: '#E1E4E8',         // 테두리
};

const Home = () => {
  // PC 접속 시 랜딩 페이지로 리다이렉트
  if (isDesktopDevice()) {
    return <Navigate to="/landing" replace />;
  }

  const navigate = useNavigate();
  const [marketData, setMarketData] = useState([]);
  const [seongjuTotal, setSeongjuTotal] = useState(null); // 성주군 합계
  const [wholesaleTotal, setWholesaleTotal] = useState(null); // 도매시장 합계
  const [availableMarkets, setAvailableMarkets] = useState([]);
  const [marketInfoMap, setMarketInfoMap] = useState(new Map()); // market_name → info 객체
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [marketSettings, setMarketSettings] = useState(null); // DB에서 가져온 시장 설정
  const [hottestPost, setHottestPost] = useState(null); // 인기 게시물
  const [hottestPostLoading, setHottestPostLoading] = useState(false);
  const hottestPostFetchedRef = useRef(false); // 중복 fetch 방지
  const hottestPostSentinelRef = useRef(null); // 스크롤 감지용

  // 날짜 선택기 모달 상태
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // 날씨 모달 상태
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);

  // 날씨 브리핑 상태
  const [weatherBriefing, setWeatherBriefing] = useState(null);
  const [briefingRegenerating, setBriefingRegenerating] = useState(false);
  const adminPermissions = useAdminPermissions();
  const { currentUser } = useContext(AuthContext);

  // 스와이프 관련 상태
  const [swipeDirection, setSwipeDirection] = useState(null); // 'left' | 'right' | null
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartTime = useRef(0);
  const swipeContainerRef = useRef(null);
  const fetchingDateRef = useRef(null); // fetch 진행 중인 날짜 (stale 캐시 저장 방지)

  // 홈페이지 스크롤 위치 복원
  const { resetScrollPosition, scrollToTop } = useScrollRestore('home', null, null, null, true);
  const scrollDirection = useScrollDirection();

  // 한국 시간 기준으로 오늘 날짜 가져오기
  const getKoreanToday = () => {
    const now = new Date();
    const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    return koreanTime.toISOString().split('T')[0];
  };

  // 로컬 스토리지에서 저장된 날짜 가져오기 (없으면 오늘 날짜)
  const getSavedDate = () => {
    try {
      const saved = localStorage.getItem('market_selected_date');
      const savedTime = localStorage.getItem('market_selected_date_time');

      if (saved && savedTime) {
        const now = Date.now();
        const savedTimestamp = parseInt(savedTime);
        const oneHour = 60 * 60 * 1000; // 1시간 = 60분 * 60초 * 1000ms

        // 1시간 이내에 저장된 날짜인지 확인
        if (now - savedTimestamp < oneHour) {
          // 저장된 날짜가 유효한지 확인
          const savedDate = new Date(saved);
          if (!isNaN(savedDate.getTime())) {
            return saved;
          }
        } else {
          // 1시간 경과 시 저장된 데이터 삭제
          localStorage.removeItem('market_selected_date');
          localStorage.removeItem('market_selected_date_time');
        }
      }
    } catch (error) {
      console.warn('저장된 날짜 불러오기 실패:', error);
    }
    return getKoreanToday();
  };

  const [selectedDate, setSelectedDate] = useState(getSavedDate());
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // 날짜 포맷 함수 (타임존 안전)
  const formatDateForDisplay = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const formatDateSimple = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('ko-KR');
  };

  // 디바이스 감지
  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(isMobileDevice() || isTabletDevice());
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);

    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // 초기 데이터 병렬 로드 (시장 설정, 날씨, 인기 게시물)
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // 병렬 실행: 시장 설정, 날씨, 공판장 정보 (LCP 개선: 병렬 로드)
        const [settings, weather, marketInfoList] = await Promise.all([
          marketService.getMarketSettings(),
          weatherService.getWeatherData(),
          marketService.getMarketInfo().catch(() => []), // 오류 시 빈 배열 fallback
        ]);

        setMarketSettings(settings);

        // 공판장 정보를 market_name 기준 Map으로 변환 (O(1) 조회)
        if (marketInfoList.length > 0) {
          const infoMap = new Map(marketInfoList.map((info) => [info.market_name, info]));
          setMarketInfoMap(infoMap);
        }

        // 날씨 브리핑: Gemini 사용
        if (weather) {
          const briefing = await weatherBriefingService.getBriefing(weather);
          if (briefing) setWeatherBriefing(briefing);
        }
      } catch (error) {
        console.error('초기 데이터 로드 실패:', error);
      }
    };

    // 인기 게시물 선제 로드 (IntersectionObserver와 별개로 미리 시작)
    // 썸네일이 LCP로 잡히므로 최대한 빨리 데이터 확보
    if (!hottestPostFetchedRef.current) {
      hottestPostFetchedRef.current = true;
      setHottestPostLoading(true);
      postService.getHottestPost()
        .then((post) => setHottestPost(post))
        .catch((err) => console.error('인기 게시물 로드 실패:', err))
        .finally(() => setHottestPostLoading(false));
    }

    loadInitialData();

  }, []);

  // 관리자 전용: Gemini로 브리핑 재생성
  const handleRegenerateBriefing = async () => {
    if (briefingRegenerating) return;
    setBriefingRegenerating(true);
    try {
      const weather = await weatherService.getWeatherData();
      const briefing = await weatherBriefingService.regenerateBriefing(weather);
      if (briefing) setWeatherBriefing(briefing);
    } catch (error) {
      alert(`요청 오류: ${error.message}`);
    } finally {
      setBriefingRegenerating(false);
    }
  };

  // 인기 게시물 지연 로딩 (스크롤 시 IntersectionObserver로 감지)
  useEffect(() => {
    const sentinel = hottestPostSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hottestPostFetchedRef.current) {
          hottestPostFetchedRef.current = true;
          setHottestPostLoading(true);
          postService.getHottestPost()
            .then((post) => setHottestPost(post))
            .catch((err) => console.error('인기 게시물 로드 실패:', err))
            .finally(() => setHottestPostLoading(false));
        }
      },
      { rootMargin: '200px' } // 200px 미리 감지 (부드러운 로딩)
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading]); // loading이 false가 되면 sentinel이 DOM에 존재

  // 시장 설정이 로드되면 기존 데이터 다시 정렬
  useEffect(() => {
    if (marketSettings?.market_order?.length > 0 && marketData.length > 0) {
      const orderArray = marketSettings.market_order;
      const sortedData = [...marketData].sort((a, b) => {
        const indexA = orderArray.indexOf(a.name);
        const indexB = orderArray.indexOf(b.name);

        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return 0;
      });
      setMarketData(sortedData);
    }
  }, [marketSettings]);

  // 경락가 데이터 가져오기 (단일 쿼리 최적화: getMarketsSummary 사용)
  const fetchMarketData = async (date) => {
    fetchingDateRef.current = date; // fetch 시작 표시 (stale 캐시 저장 방지)
    try {
      // 기존 데이터가 없을 때만 스켈레톤 표시 (날짜 변경 시에는 기존 카드 유지 → CLS 방지)
      if (marketData.length === 0 && !seongjuTotal) {
        setLoading(true);
      }

      // 경락가 + 성주군 합계 + 도매시장 합계를 병렬 조회 (네트워크 왕복 1회)
      const [response, seongjuAggregate, wholesaleAggregate] = await Promise.all([
        marketService.getMarketsSummary(date),
        marketService.getSeongjuAggregateForCard(date),
        marketService.getWholesaleAggregateForCard(date),
      ]);

      // 날짜 변경 중 stale 응답 무시
      if (fetchingDateRef.current && fetchingDateRef.current !== date) return;

      // 시장 목록 업데이트
      if (!response) {
        setMarketData([]);
        setSeongjuTotal(null);
        setWholesaleTotal(null);
        return;
      }
      setAvailableMarkets(response.availableMarkets || []);

      // 데이터가 없으면 빈 배열로 설정
      if (!response.markets || response.markets.length === 0) {
        setMarketData([]);
        setSeongjuTotal(null);
        setWholesaleTotal(null);
        sessionStorage.removeItem('home_market_data');
        sessionStorage.removeItem('home_selected_date');
        sessionStorage.removeItem('home_cache_time');
        sessionStorage.removeItem('home_seongju_total');
        sessionStorage.removeItem('home_wholesale_total');
        return;
      }

      const transformedData = response.markets.map((market, index) => {
        if (market.success && market.data && market.data.details) {
          const details = market.data.details || [];
          const totalQuantity = details.reduce((sum, item) => sum + (item.boxes || 0), 0);
          const avgPrice = market.data.summary?.overall_avg_price || 0;
          const prices = details.map(item => item.min_price || 0).filter(p => p > 0);
          const maxPrices = details.map(item => item.max_price || 0).filter(p => p > 0);
          const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
          const maxPrice = maxPrices.length > 0 ? Math.max(...maxPrices) : 0;
          const overallComparison = market.data.overall_comparison;
          const volumeComparison = market.data.volume_comparison;
          const previousData = overallComparison?.comparison_available ? {
            totalQuantity: volumeComparison?.previousVolume,
            averagePrice: overallComparison.previousPrice,
            minPrice: market.data.previous_min_price || 0,
            maxPrice: market.data.previous_max_price || 0,
          } : null;
          const totalAmount = market.data.summary?.total_amount || 0;

          return {
            id: index + 1,
            name: market.market_name,
            totalQuantity,
            totalAmount,
            averagePrice: avgPrice,
            minPrice,
            maxPrice,
            unit: '상자',
            priceUnit: '원',
            previousTotalQuantity: previousData?.totalQuantity,
            previousAveragePrice: previousData?.averagePrice,
            previousMinPrice: previousData?.minPrice,
            previousMaxPrice: previousData?.maxPrice,
            isFinalized: market.is_finalized ?? false
          };
        } else {
          return {
            id: index + 1,
            name: market.market_name,
            totalQuantity: 0,
            averagePrice: 0,
            minPrice: 0,
            maxPrice: 0,
            unit: '상자',
            priceUnit: '원',
            error: true
          };
        }
      });

      // 시장 순서 정렬: DB 설정에서 가져온 market_order 사용
      const settings = marketSettings || await marketService.getMarketSettings();
      const sortedData = [...transformedData].sort((a, b) => {
        if (settings?.market_order?.length > 0) {
          const orderArray = settings.market_order;
          const indexA = orderArray.indexOf(a.name);
          const indexB = orderArray.indexOf(b.name);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
        }
        // 기본: 가나다순 정렬
        return a.name.localeCompare(b.name, 'ko');
      });

      setMarketData(sortedData);

      // 도매시장 합계 처리 (market_aggregate_summary에서 DB 조회 - 성주군과 동일 패턴)
      if (wholesaleAggregate?.today && (wholesaleAggregate.today.avg_price > 0 || wholesaleAggregate.today.total_boxes > 0)) {
        const wToday = wholesaleAggregate.today;
        const wPrev = wholesaleAggregate.previous;

        setWholesaleTotal({
          id: 'wholesale-total',
          name: '도매시장 합계',
          totalQuantity: wToday.total_boxes || 0,
          totalAmount: wToday.total_amount || 0,
          averagePrice: wToday.avg_price || 0,
          maxPrice: wToday.max_price || 0,
          minPrice: wToday.min_price || 0,
          unit: '상자',
          priceUnit: '원',
          previousTotalQuantity: wPrev ? wPrev.total_boxes : null,
          previousAveragePrice: wPrev ? wPrev.avg_price : null,
          previousMaxPrice: wPrev ? wPrev.max_price : null,
          previousMinPrice: wPrev ? wPrev.min_price : null,
          isTotal: true,
          isWholesaleTotal: true, // 도매시장 합계 구분 플래그
          isFinalized: wToday.is_finalized ?? false,
        });
      } else {
        setWholesaleTotal(null);
      }

      // 성주군 합계 처리 (이미 병렬로 가져옴)
      if (seongjuAggregate?.today) {
        const todayData = seongjuAggregate.today;
        const prev = seongjuAggregate.previous;

        setSeongjuTotal({
          id: 'seongju-total',
          name: '성주군 합계',
          totalQuantity: todayData.total_boxes || 0,
          totalAmount: todayData.total_amount || 0,
          averagePrice: todayData.avg_price || 0,
          maxPrice: todayData.max_price || 0,
          minPrice: todayData.min_price || 0,
          unit: '상자',
          priceUnit: '원',
          previousTotalQuantity: prev ? prev.total_boxes : null,
          previousAveragePrice: prev ? prev.avg_price : null,
          previousMaxPrice: prev ? prev.max_price : null,
          previousMinPrice: prev ? prev.min_price : null,
          isTotal: true,
          isFinalized: todayData.is_finalized ?? false
        });
      } else {
        setSeongjuTotal(null);
      }

    } catch (error) {
      console.error('[Home] 경락가 조회 실패:', error);
      // API 실패시 빈 배열로 설정하여 에러 메시지 표시
      setMarketData([]);
      setSeongjuTotal(null);
      setWholesaleTotal(null);
    } finally {
      fetchingDateRef.current = null; // fetch 완료
      setLoading(false);
    }
  };

  // 초기 로드 시 데이터 가져오기 (캐시 사용으로 빠른 복귀)
  useEffect(() => {
    const loadMarketData = async () => {
      // 강제새로고침(reload) 또는 상세보기 방문 후 복귀 시 캐시 무효화
      // sessionStorage는 F5/Ctrl+F5에서 지워지지 않으므로 직접 처리
      const isReload = (() => {
        try {
          return performance.getEntriesByType('navigation')[0]?.type === 'reload';
        } catch { return false; }
      })();
      const cameFromDetail = sessionStorage.getItem('home_cache_invalidate') === 'true';

      if (isReload || cameFromDetail) {
        sessionStorage.removeItem('home_market_data');
        sessionStorage.removeItem('home_selected_date');
        sessionStorage.removeItem('home_cache_time');
        sessionStorage.removeItem('home_seongju_total');
        sessionStorage.removeItem('home_wholesale_total');
        sessionStorage.removeItem('home_cache_invalidate');
      }

      // sessionStorage에서 캐시된 데이터 확인 (뒤로가기, Link 이동 모두 지원)
      try {
        const cachedData = sessionStorage.getItem('home_market_data');
        const cachedSeongjuTotal = sessionStorage.getItem('home_seongju_total');
        const cachedWholesaleTotal = sessionStorage.getItem('home_wholesale_total');
        const cachedDate = sessionStorage.getItem('home_selected_date');
        const cacheTime = sessionStorage.getItem('home_cache_time');

        // 캐시가 있고 5분 이내 + 같은 날짜인 경우 캐시 사용
        if (cachedData && cacheTime && cachedDate) {
          const cacheAge = Date.now() - parseInt(cacheTime);
          const fiveMinutes = 5 * 60 * 1000;

          if (cacheAge < fiveMinutes && cachedDate === selectedDate) {
            setMarketData(JSON.parse(cachedData));
            if (cachedSeongjuTotal) {
              setSeongjuTotal(JSON.parse(cachedSeongjuTotal));
            } else {
              setSeongjuTotal(null);
            }
            if (cachedWholesaleTotal) {
              setWholesaleTotal(JSON.parse(cachedWholesaleTotal));
            } else {
              setWholesaleTotal(null);
            }
            setLoading(false);
            return; // 캐시 사용, API 호출 안함
          }
        }
      } catch (error) {
        console.warn('캐시 로드 실패:', error);
      }

      // 저장된 날짜가 있고 유효한 경우 (1시간 이내) 해당 날짜로 조회
      const savedDate = getSavedDate();

      // localStorage에 저장된 날짜가 있으면 해당 날짜 사용
      const hasSavedDate = localStorage.getItem('market_selected_date') &&
                           localStorage.getItem('market_selected_date_time');

      if (hasSavedDate) {
        const savedTime = parseInt(localStorage.getItem('market_selected_date_time'));
        const oneHour = 60 * 60 * 1000;

        // 1시간 이내에 저장된 날짜가 있으면 해당 날짜로 조회
        if (Date.now() - savedTime < oneHour) {
          setSelectedDate(savedDate);
          fetchMarketData(savedDate);
          return;
        }
      }

      // 저장된 날짜가 없거나 만료된 경우, 오늘 날짜로 조회
      fetchMarketData(selectedDate);
    };
    loadMarketData();
  }, []); // 최초 로드 시에만 실행

  // 날짜 변경 시 로컬 스토리지에 저장 (타임스탬프와 함께)
  useEffect(() => {
    try {
      localStorage.setItem('market_selected_date', selectedDate);
      localStorage.setItem('market_selected_date_time', Date.now().toString());
    } catch (error) {
      console.warn('날짜 저장 실패:', error);
    }
  }, [selectedDate]);

  // 시장 데이터가 변경되면 sessionStorage에 캐싱 (뒤로가기 시 사용)
  useEffect(() => {
    // fetch 진행 중이면 stale 데이터가 새 날짜로 저장되는 것 방지
    if (fetchingDateRef.current) return;

    if (marketData.length > 0 && !loading) {
      try {
        sessionStorage.setItem('home_market_data', JSON.stringify(marketData));
        sessionStorage.setItem('home_selected_date', selectedDate);
        sessionStorage.setItem('home_cache_time', Date.now().toString());
        if (seongjuTotal) {
          sessionStorage.setItem('home_seongju_total', JSON.stringify(seongjuTotal));
        } else {
          sessionStorage.removeItem('home_seongju_total');
        }
        if (wholesaleTotal) {
          sessionStorage.setItem('home_wholesale_total', JSON.stringify(wholesaleTotal));
        } else {
          sessionStorage.removeItem('home_wholesale_total');
        }
      } catch (error) {
        console.warn('캐시 저장 실패:', error);
      }
    }
  }, [marketData, seongjuTotal, wholesaleTotal, selectedDate, loading]);

  const formatPrice = (price) => {
    return price.toLocaleString('ko-KR');
  };

  const handleDateChange = (e) => {
    // 날짜 선택 시 상태만 업데이트 (조회는 버튼 클릭 시)
    setSelectedDate(e.target.value);
  };

  const handleRefresh = () => {
    fetchMarketData(selectedDate);
  };

  // 날짜 하루 변경 함수
  const changeDate = useCallback((days) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);
    currentDate.setDate(currentDate.getDate() + days);

    // 오늘 날짜를 로컬 시간 기준으로 생성
    const todayStr = getKoreanToday();
    const [tYear, tMonth, tDay] = todayStr.split('-').map(Number);
    const today = new Date(tYear, tMonth - 1, tDay);

    // 오늘 이후로는 이동 불가
    if (currentDate > today) return;

    // 새 날짜를 YYYY-MM-DD 형식으로 변환 (로컬 시간 기준)
    const newYear = currentDate.getFullYear();
    const newMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const newDay = String(currentDate.getDate()).padStart(2, '0');
    const newDate = `${newYear}-${newMonth}-${newDay}`;

    setSelectedDate(newDate);
    fetchMarketData(newDate);
  }, [selectedDate]);

  // 이전 날짜로 이동
  const goToPreviousDay = useCallback(() => {
    setSwipeDirection('right');
    changeDate(-1);
    setTimeout(() => setSwipeDirection(null), 300);
  }, [changeDate]);

  // 다음 날짜로 이동
  const goToNextDay = useCallback(() => {
    const today = getKoreanToday();
    if (selectedDate >= today) return; // 오늘 이후로는 이동 불가

    setSwipeDirection('left');
    changeDate(1);
    setTimeout(() => setSwipeDirection(null), 300);
  }, [changeDate, selectedDate]);

  // 스와이프 핸들러
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchMove = useCallback((e) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    // 스와이프가 발생하지 않았으면 무시
    if (touchStartX.current === 0 && touchEndX.current === 0) return;

    const diffX = touchStartX.current - touchEndX.current;
    const timeDiff = Date.now() - touchStartTime.current;
    const minSwipeDistance = 120; // 최소 스와이프 거리 (120px로 증가)
    const maxSwipeTime = 500; // 최대 스와이프 시간 (500ms 이내)

    // 충분히 빠르고 길게 스와이프했을 때만 동작
    if (Math.abs(diffX) > minSwipeDistance && timeDiff < maxSwipeTime) {
      if (diffX > 0) {
        // 왼쪽으로 스와이프 (손가락이 오른쪽에서 왼쪽으로) -> 다음 날짜
        goToNextDay();
      } else {
        // 오른쪽으로 스와이프 (손가락이 왼쪽에서 오른쪽으로) -> 이전 날짜
        goToPreviousDay();
      }
    }

    // 초기화
    touchStartX.current = 0;
    touchEndX.current = 0;
    touchStartTime.current = 0;
  }, [goToNextDay, goToPreviousDay]);

// PC 사용자를 위한 안내 화면
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-green-50 flex items-center justify-center relative overflow-hidden">
        {/* 배경 장식 요소 */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="max-w-2xl mx-auto p-8 text-center relative z-10">
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl border border-gray-200/50 p-12">
            {/* 헤더 섹션 */}
            <div className="mb-8">
              <div className="inline-block p-4 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl mb-6 shadow-lg">
                <StoreIcon className="text-6xl text-white" />
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-500 to-green-500 bg-clip-text text-transparent mb-4">
                참외 이야기
              </h1>
              <p className="text-xl text-gray-600">
                성주 지역 농산물 거래와 소통을 위한 커뮤니티 플랫폼
              </p>
            </div>

            {/* 정보 카드 */}
            <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl p-6 mb-8 border border-blue-100">
              <h2 className="text-2xl font-semibold text-gray-800 mb-3">
                PC에서는 관리 기능만 제공됩니다
              </h2>
              <p className="text-gray-600 mb-6">
                경락가 정보, 커뮤니티, 광고 등은 모바일에서만 이용 가능합니다.
              </p>

              {/* 버튼 그룹 */}
              <div className="space-y-3">
                <Link
                  to="/admin"
                  className="block w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  🖥️ 관리자 대시보드
                </Link>
                <Link
                  to="/login"
                  className="block w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 px-6 rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  👤 로그인
                </Link>
              </div>
            </div>

            {/* 안내 메시지 */}
            <div className="text-sm text-gray-500 space-y-2">
              <p className="flex items-center justify-center gap-2">
                <span className="text-2xl">📱</span>
                <span>모바일에서 접속하시면 전체 기능을 이용하실 수 있습니다.</span>
              </p>
              <p className="text-xs">
                현재 화면 크기: {window.innerWidth}px × {window.innerHeight}px
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 오늘 날짜인지 확인
  const isToday = selectedDate >= getKoreanToday();

  // 모바일 사용자를 위한 기존 화면
  return (
    <div className="min-h-screen bg-base-200 pb-28 safe-area-bottom">
      {/* 상단 헤더 공간 확보 */}
      <div className="h-14"></div>

      {/* 날짜 선택기 헤더 - 카드 상단 고정 */}
      <div
        className="flex items-center justify-between px-3 py-2 shadow-sm border-b border-base-300 sticky top-14 z-30 bg-base-200 text-base-content"
      >
        {/* 왼쪽 여백 (날씨 위젯과 균형) */}
        <div className="w-12 shrink-0"></div>

        {/* 중앙: 날짜 선택기 */}
        <div className="flex items-center gap-1 whitespace-nowrap">
          <button onClick={goToPreviousDay} className="p-0.5 haptic-feedback" aria-label="이전 날짜">
            <ChevronLeftIcon style={{ fontSize: '20px' }} />
          </button>
          <button onClick={() => setIsDatePickerOpen(true)} className="flex items-center haptic-feedback" aria-label="날짜 선택">
            <span className="font-bold text-lg whitespace-nowrap">{selectedDate}</span>
            <KeyboardArrowDownIcon style={{ fontSize: '22px' }} />
          </button>
          <button
            onClick={goToNextDay}
            disabled={isToday}
            className={`p-0.5 haptic-feedback ${isToday ? 'opacity-30' : ''}`}
            aria-label="다음 날짜"
          >
            <ChevronRightIcon style={{ fontSize: '20px' }} />
          </button>
        </div>

        {/* 오른쪽: 날씨 위젯 */}
        <div className="w-16 shrink-0 flex justify-end pr-2">
          <WeatherWidget onClick={() => setIsWeatherModalOpen(true)} />
        </div>
      </div>

      {/* DatePicker 모달 */}
      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        selectedDate={selectedDate}
        onSelectDate={(date) => {
          setSelectedDate(date);
          fetchMarketData(date);
        }}
        maxDate={getKoreanToday()}
      />

      {/* 날씨 모달 */}
      <WeatherModal
        isOpen={isWeatherModalOpen}
        onClose={() => setIsWeatherModalOpen(false)}
        briefing={weatherBriefing}
      />

      {/* 메인 콘텐츠 - 스와이프 영역 */}
      <div
        ref={swipeContainerRef}
        className={`w-full max-w-screen-xl mx-auto p-4 swipeable scroll-smooth transition-transform duration-300 ${
          swipeDirection === 'left' ? 'animate-slide-left' : ''
        } ${swipeDirection === 'right' ? 'animate-slide-right' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 푸시 알림 구독 배너 */}
        <PushNotificationBanner />

        <MarketCards
          marketData={marketData}
          seongjuTotal={seongjuTotal}
          wholesaleTotal={wholesaleTotal}
          loading={loading}
          selectedDate={selectedDate}
          formatPrice={formatPrice}
          formatDateForDisplay={formatDateForDisplay}
          handleRefresh={handleRefresh}
          marketInfoMap={marketInfoMap}
        />

        {/* 산지+도매 종합 합산 카드 — 자체 데이터 조회 (baseDate 기준) */}
        {!loading && (
          <CombinedMarketCard
            selectedDate={selectedDate}
            formatPrice={formatPrice}
          />
        )}

        {/* 인기 게시물 섹션 - 스크롤 시 지연 로딩 */}
        {!loading && (
          <div className="mt-6" ref={hottestPostSentinelRef}>
            {hottestPostLoading && (
              <div className="animate-pulse">
                <div className="h-5 w-24 bg-base-300 rounded mb-3"></div>
                <div className="rounded-2xl overflow-hidden shadow-md border border-base-200 bg-base-100">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-base-300 rounded-full"></div>
                      <div className="h-4 w-24 bg-base-300 rounded"></div>
                    </div>
                    <div className="h-4 w-full bg-base-300 rounded"></div>
                    <div className="h-4 w-3/4 bg-base-300 rounded"></div>
                    <div className="aspect-[4/5] bg-base-content/20 rounded-lg"></div>
                  </div>
                </div>
              </div>
            )}
            {hottestPost && (
              <>
                <span className="font-bold text-base-content mb-3 block">인기 게시물</span>
                <EnhancedInstagramPost
                  post={hottestPost}
                  isVisible={true}
                  disableAutoplay={true}
                  priority={true}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* 플로팅 버튼: 오른쪽 세로 (검색 + 즐겨찾기), 왼쪽 (admin) */}
      {/* 검색 버튼 (오른쪽 하단) */}
      <button
        onClick={() => setSearchModalOpen(true)}
        className={`fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 bg-blue-600 hover:bg-blue-700 active:scale-95 ${
          scrollDirection === 'down' ? 'translate-x-20' : 'translate-x-0'
        }`}
        title="도매시장 법인 검색"
      >
        <SearchIcon className="text-white" />
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
          onClick={handleRegenerateBriefing}
          disabled={briefingRegenerating}
          className={`fixed bottom-24 left-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
            briefingRegenerating
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#004225] hover:bg-[#003018] active:scale-95'
          } ${scrollDirection === 'down' ? '-translate-x-20' : 'translate-x-0'}`}
          title="날씨 브리핑 재생성"
        >
          {briefingRegenerating ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <AutoAwesomeIcon className="text-white" />
          )}
        </button>
      )}
    </div>
  );
};

export default Home;