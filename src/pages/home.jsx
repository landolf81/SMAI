import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import StoreIcon from '@mui/icons-material/Store';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
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
  const [availableMarkets, setAvailableMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [marketSettings, setMarketSettings] = useState(null); // DB에서 가져온 시장 설정
  const [hottestPost, setHottestPost] = useState(null); // 인기 게시물

  // 날짜 선택기 모달 상태
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // 날씨 모달 상태
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);

  // 날씨 브리핑 상태
  const [weatherBriefing, setWeatherBriefing] = useState(null);

  // 스와이프 관련 상태
  const [swipeDirection, setSwipeDirection] = useState(null); // 'left' | 'right' | null
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartTime = useRef(0);
  const swipeContainerRef = useRef(null);

  // 홈페이지 스크롤 위치 복원
  const { resetScrollPosition, scrollToTop } = useScrollRestore('home', null, null, null, true);

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

  // 시장 설정 로드 (공판장 정렬 순서)
  useEffect(() => {
    marketService.getMarketSettings().then(settings => {
      setMarketSettings(settings);
    });
  }, []);

  // 날씨 브리핑 로드
  useEffect(() => {
    const loadWeatherBriefing = async () => {
      try {
        const weather = await weatherService.getWeatherData();
        if (weather) {
          const briefing = await weatherBriefingService.getBriefing(weather);
          setWeatherBriefing(briefing);
        }
      } catch (error) {
        console.error('날씨 브리핑 로드 실패:', error);
      }
    };
    loadWeatherBriefing();
  }, []);

  // 인기 게시물 로드
  useEffect(() => {
    const loadHottestPost = async () => {
      try {
        const post = await postService.getHottestPost();
        setHottestPost(post);
      } catch (error) {
        console.error('인기 게시물 로드 실패:', error);
      }
    };
    loadHottestPost();
  }, []);

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

  // 실제 데이터가 있는 시장 목록 가져오기
  const fetchAvailableMarkets = async (date) => {
    try {
      const markets = await marketService.getAvailableMarkets(date);

      if (markets && markets.length > 0) {
        setAvailableMarkets(markets);
        return markets;
      } else {
        setAvailableMarkets([]);
        return [];
      }
    } catch (error) {
      // Available markets 조회 실패
      console.error('시장 목록 조회 실패:', error);
      setAvailableMarkets([]);
      return [];
    }
  };

  // 경락가 데이터 가져오기 (실제 API 호출)
  const fetchMarketData = async (date) => {
    try {
      setLoading(true);

      // 먼저 해당 날짜에 데이터가 있는 시장 목록을 가져옴
      const markets = await fetchAvailableMarkets(date);

      // 데이터가 없으면 빈 배열로 설정 (자동 이동 없음)
      if (markets.length === 0) {
        setMarketData([]);
        return;
      }

      // 실제 데이터가 있는 시장들의 경락가 정보 조회
      const response = await marketService.getMultipleMarkets(markets, date);

      if (response && response.markets) {
        const transformedData = response.markets.map((market, index) => {
          if (market.success && market.data && market.data.details) {
            // 시장 데이터에서 평균값 계산
            const details = market.data.details;
            const totalQuantity = details.reduce((sum, item) => sum + (item.boxes || 0), 0);
            
            // DB에서 제공하는 올바른 가중 평균 사용
            const avgPrice = market.data.summary?.overall_avg_price || 0;
            
            const minPrice = Math.min(...details.map(item => item.min_price || 0));
            const maxPrice = Math.max(...details.map(item => item.max_price || 0));
            
            // 전일 비교 데이터 추출 (MarketAPIService 형식)
            const overallComparison = market.data.overall_comparison;
            const volumeComparison = market.data.volume_comparison;
            const comparison = market.data.comparison; // LocalMarketService용 (사용되지 않음)
            
            // 현재 데이터의 실제 최저가/최고가 계산
            const currentMinPrice = details.length > 0 ? Math.min(...details.map(item => item.min_price || 0)) : 0;
            const currentMaxPrice = details.length > 0 ? Math.max(...details.map(item => item.max_price || 0)) : 0;
            
            // 전일 비교 데이터 - API에서 제공하는 previous_min_price, previous_max_price 사용
            const previousData = overallComparison?.comparison_available ? {
              totalQuantity: volumeComparison?.previousVolume,
              averagePrice: overallComparison.previousPrice,
              minPrice: market.data.previous_min_price || 0,
              maxPrice: market.data.previous_max_price || 0,
            } : null;

            // DB에서 제공하는 실제 총 거래금액 사용
            const totalAmount = market.data.summary?.total_amount || 0;

            return {
              id: index + 1,
              name: market.market_name,
              totalQuantity,
              totalAmount, // 실제 DB 거래금액
              averagePrice: avgPrice,
              minPrice,
              maxPrice,
              unit: '상자',
              priceUnit: '원',
              // 실제 전일 데이터
              previousTotalQuantity: previousData?.totalQuantity,
              previousAveragePrice: previousData?.averagePrice,
              previousMinPrice: previousData?.minPrice,
              previousMaxPrice: previousData?.maxPrice
            };
          } else {
            // API 실패시 기본값 반환
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
        const sortedData = [...transformedData].sort((a, b) => {
          // DB에 저장된 순서가 있으면 사용
          if (marketSettings?.market_order?.length > 0) {
            const orderArray = marketSettings.market_order;
            const indexA = orderArray.indexOf(a.name);
            const indexB = orderArray.indexOf(b.name);

            // 둘 다 목록에 있으면 순서대로
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            // 목록에 없는 건 뒤로
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
          }

          // 설정이 없으면 기본 정렬 (가락, 대전은 마지막)
          const isASpecial = a.name.includes('가락') || a.name.includes('대전');
          const isBSpecial = b.name.includes('가락') || b.name.includes('대전');

          if (isASpecial && !isBSpecial) return 1;
          if (!isASpecial && isBSpecial) return -1;

          if (isASpecial && isBSpecial) {
            if (a.name.includes('가락') && b.name.includes('대전')) return -1;
            if (a.name.includes('대전') && b.name.includes('가락')) return 1;
          }

          return a.name.localeCompare(b.name);
        });

        setMarketData(sortedData);
      } else {
        throw new Error('API 응답 형식이 올바르지 않습니다.');
      }
      
    } catch (error) {
      // API 호출 실패
      
      // API 실패시 빈 배열로 설정하여 에러 메시지 표시
      setMarketData([]);
    } finally {
      setLoading(false);
    }
  };

  // 초기 로드 시 데이터 가져오기
  useEffect(() => {
    const loadMarketData = async () => {
      // 저장된 날짜가 있고 유효한 경우 (1시간 이내) 해당 날짜로 조회
      const savedDate = getSavedDate();
      const today = getKoreanToday();

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

      // 저장된 날짜가 없거나 만료된 경우, DB에서 마지막 경락일 조회
      try {
        const latestDate = await marketService.getLatestMarketDate();
        if (latestDate) {
          setSelectedDate(latestDate);
          fetchMarketData(latestDate);
        } else {
          fetchMarketData(selectedDate);
        }
      } catch (error) {
        console.error('마지막 경락일 조회 실패:', error);
        fetchMarketData(selectedDate);
      }
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
    <div className="min-h-screen bg-cloud-dancer pb-28 safe-area-bottom">
      {/* 상단 헤더 공간 확보 */}
      <div className="h-14"></div>

      {/* 날짜 선택기 헤더 - 카드 상단 고정 */}
      <div
        className="flex items-center justify-between px-3 py-2 shadow-sm border-b sticky top-14 z-30 bg-cloud-dancer"
        style={{ borderColor: COLORS.border, color: COLORS.mainGreen }}
      >
        {/* 왼쪽 여백 (날씨 위젯과 균형) */}
        <div className="w-12 shrink-0"></div>

        {/* 중앙: 날짜 선택기 */}
        <div className="flex items-center gap-1 whitespace-nowrap">
          <button onClick={goToPreviousDay} className="p-0.5 haptic-feedback">
            <ChevronLeftIcon style={{ fontSize: '20px' }} />
          </button>
          <button onClick={() => setIsDatePickerOpen(true)} className="flex items-center haptic-feedback">
            <span className="font-bold text-lg whitespace-nowrap">{selectedDate}</span>
            <KeyboardArrowDownIcon style={{ fontSize: '22px' }} />
          </button>
          <button
            onClick={goToNextDay}
            disabled={isToday}
            className={`p-0.5 haptic-feedback ${isToday ? 'opacity-30' : ''}`}
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
        <MarketCards
          marketData={marketData}
          loading={loading}
          selectedDate={selectedDate}
          formatPrice={formatPrice}
          formatDateForDisplay={formatDateForDisplay}
          handleRefresh={handleRefresh}
        />

        {/* 인기 게시물 섹션 */}
        {hottestPost && (
          <div className="mt-6">
            {/* 섹션 헤더 */}
            <div
              className="flex items-center justify-between mb-3 cursor-pointer"
              onClick={() => navigate('/community')}
            >
              <span className="font-bold text-gray-800">인기 게시물</span>
              <div className="flex items-center text-gray-500 text-sm">
                <span>커뮤니티</span>
                <ChevronRightRoundedIcon style={{ fontSize: 20 }} />
              </div>
            </div>

            {/* 인기 게시물 카드 - 커뮤니티 피드와 동일한 형태 */}
            <EnhancedInstagramPost
              post={hottestPost}
              isVisible={true}
              disableAutoplay={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;