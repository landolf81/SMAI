import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import StoreIcon from '@mui/icons-material/Store';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { marketService } from '../services';
import MarketCards from '../components/MarketCards';
import DatePickerModal from '../components/DatePickerModal';
import { isMobileDevice, isTabletDevice } from '../utils/deviceDetector';
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
  const [marketData, setMarketData] = useState([]);
  const [availableMarkets, setAvailableMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // 날짜 선택기 모달 상태
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

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
        
        // 시장 순서 정렬: 가락공판장, 대전공판장을 마지막으로 이동
        const sortedData = transformedData.sort((a, b) => {
          const isASpecial = a.name.includes('가락') || a.name.includes('대전');
          const isBSpecial = b.name.includes('가락') || b.name.includes('대전');
          
          if (isASpecial && !isBSpecial) return 1;
          if (!isASpecial && isBSpecial) return -1;
          
          // 가락과 대전 사이에서는 가락을 먼저
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 loading-container safe-area-top safe-area-bottom">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="mt-4 text-gray-600">경락가 정보를 불러오는 중...</p>
          <div className="mt-2 text-sm text-gray-500">
            {formatDateSimple(selectedDate)} 데이터 조회 중
          </div>
        </div>
      </div>
    );
  }

  // PC 사용자를 위한 안내 화면
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="max-w-2xl mx-auto p-8 text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="mb-6">
              <StoreIcon className="text-6xl text-green-600 mb-4" />
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                메리디안 농업 커뮤니티
              </h1>
              <p className="text-gray-600">
                모바일 전용 농업 커뮤니티 웹앱
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">
                PC에서는 관리 기능만 제공됩니다
              </h2>
              <p className="text-gray-600 mb-4">
                경락가 정보, 커뮤니티, 광고 등은 모바일에서만 이용 가능합니다.
              </p>
              
              <div className="space-y-3">
                <Link 
                  to="/admin" 
                  className="block w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  🖥️ 관리자 대시보드
                </Link>
                <Link 
                  to="/login" 
                  className="block w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  👤 로그인
                </Link>
              </div>
            </div>
            
            <div className="text-sm text-gray-500">
              <p className="mb-2">📱 모바일에서 접속하시면 전체 기능을 이용하실 수 있습니다.</p>
              <p>
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
    <div className="min-h-screen bg-gray-50 pb-20 safe-area-bottom">
      {/* 날짜 선택기 헤더 */}
      <div
        className="flex items-center justify-center gap-1 py-1.5 shadow-sm border-b sticky top-16 z-10 bg-white"
        style={{ borderColor: COLORS.border, color: COLORS.mainGreen }}
      >
        <button onClick={goToPreviousDay} className="p-0.5 haptic-feedback">
          <ChevronLeftIcon style={{ fontSize: '20px' }} />
        </button>
        <button onClick={() => setIsDatePickerOpen(true)} className="flex items-center haptic-feedback">
          <span className="font-bold text-lg">{selectedDate}</span>
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
      </div>
    </div>
  );
};

export default Home;