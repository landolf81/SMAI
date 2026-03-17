import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { marketService } from '../services';
import LoadingSpinner from '../components/LoadingSpinner';
import DatePickerModal from '../components/DatePickerModal';

// 고정 공휴일 (MM-DD 형식)
const FIXED_HOLIDAYS = [
  '01-01', // 신정
  '03-01', // 삼일절
  '05-05', // 어린이날
  '06-06', // 현충일
  '08-15', // 광복절
  '10-03', // 개천절
  '10-09', // 한글날
  '12-25', // 성탄절
];

// 변동 공휴일 (음력 기반, 연도별 - 설날, 부처님오신날, 추석)
const LUNAR_HOLIDAYS = {
  2025: ['01-28', '01-29', '01-30', '05-05', '10-05', '10-06', '10-07'],
  2026: ['02-16', '02-17', '02-18', '05-24', '09-24', '09-25', '09-26'],
};

// 대체공휴일 (연도별)
const SUBSTITUTE_HOLIDAYS = {
  2025: ['03-03', '05-06', '10-08'], // 삼일절(토), 어린이날/부처님오신날 중복, 추석(일)
  2026: ['03-02', '08-17', '09-28', '10-05'], // 삼일절(일), 광복절(토), 추석(토), 개천절(토)
};

// 공휴일 체크 함수
const isHoliday = (dateStr) => {
  if (!dateStr) return false;
  const mmdd = dateStr.slice(5); // MM-DD
  const year = parseInt(dateStr.slice(0, 4));

  // 고정 공휴일 체크
  if (FIXED_HOLIDAYS.includes(mmdd)) return true;

  // 변동 공휴일 체크
  if (LUNAR_HOLIDAYS[year]?.includes(mmdd)) return true;

  // 대체공휴일 체크
  if (SUBSTITUTE_HOLIDAYS[year]?.includes(mmdd)) return true;

  return false;
};

/**
 * 경락가 추세 차트 페이지
 *
 * 용도: 공판장별 경락가 추세를 라인 차트로 시각화
 * 기능: 기간 선택(7일/30일/90일/직접설정), 작년 동기 비교(점선)
 */
const MarketTrend = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const marketName = searchParams.get('market') || '선남농협';

  // 상태
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState([]);
  const [lastYearData, setLastYearData] = useState([]);
  const [periodDays, setPeriodDays] = useState(30); // 기본 30일
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [isCustomPeriod, setIsCustomPeriod] = useState(false);
  const [yearlyCumulative, setYearlyCumulative] = useState(null);

  // 오늘 날짜 (한국 시간)
  const getKoreanToday = () => {
    const now = new Date();
    const koreanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return koreanTime.toISOString().split('T')[0];
  };

  const today = getKoreanToday();

  // 날짜 계산 함수 (오늘을 중심으로 좌우로 표시)
  const getDateRange = (days) => {
    const formatDate = (d) => d.toISOString().split('T')[0];

    // 오늘을 중심으로 좌우로 날짜 계산
    const halfDays = Math.floor(days / 2);
    const start = new Date(today);
    const end = new Date(today);

    start.setDate(start.getDate() - halfDays);
    end.setDate(end.getDate() + halfDays);

    return { startDate: formatDate(start), endDate: formatDate(end) };
  };

  // 작년 동일 기간 계산
  const getLastYearRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setFullYear(start.getFullYear() - 1);
    end.setFullYear(end.getFullYear() - 1);

    const formatDate = (d) => d.toISOString().split('T')[0];
    return { startDate: formatDate(start), endDate: formatDate(end) };
  };

  // 성주군 합계 / 도매시장 합계 여부 확인
  const isSeongjuTotal = marketName === '성주군 합계';
  const isWholesaleTotal = marketName === '도매시장 합계';
  // aggregate 테이블 사용 여부 (성주군 합계 / 도매시장 합계 모두 DB 사전 집계 사용)
  const isAggregateSource = isSeongjuTotal || isWholesaleTotal;

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      let startDate, endDate;
      if (isCustomPeriod && customStartDate && customEndDate) {
        startDate = customStartDate;
        endDate = customEndDate;
      } else {
        const range = getDateRange(periodDays);
        startDate = range.startDate;
        endDate = range.endDate;
      }

      // 올해 데이터: 시작일 ~ 오늘 (미래 데이터 없음)
      const currentEndDate = endDate > today ? today : endDate;

      // 성주군 합계 / 도매시장 합계 / 일반 공판장에 따라 데이터 소스 분기
      // 도매시장 합계는 market_aggregate_summary(region_name='도매시장')에서 DB 조회
      // (기존 프론트엔드 집계 방식 → DB 트리거 사전 집계 방식으로 변경)
      let currentData;
      if (isSeongjuTotal) {
        currentData = await marketService.getSeongjuAggregateTrend(startDate, currentEndDate);
      } else if (isWholesaleTotal) {
        currentData = await marketService.getWholesaleTrendData(startDate, currentEndDate);
      } else {
        currentData = await marketService.getMarketTrendData(marketName, startDate, currentEndDate);
      }

      // 작년 동기 데이터: 작년 전체 기간 (미래 포함)
      const lastYearRange = getLastYearRange(startDate, endDate);
      let lastYear;
      if (isSeongjuTotal) {
        lastYear = await marketService.getSeongjuAggregateTrend(lastYearRange.startDate, lastYearRange.endDate);
      } else if (isWholesaleTotal) {
        lastYear = await marketService.getWholesaleTrendData(lastYearRange.startDate, lastYearRange.endDate);
      } else {
        lastYear = await marketService.getMarketTrendData(marketName, lastYearRange.startDate, lastYearRange.endDate);
      }

      // 연간 누적 (1월1일~오늘, 작년 동기)
      // 도매시장 합계도 aggregate 테이블에서 직접 조회 (성주군과 동일한 getYearlyCumulative 사용 불가 - 별도 함수)
      let cumulative;
      if (isWholesaleTotal) {
        cumulative = await marketService.getWholesaleYearlyCumulative(today);
      } else {
        cumulative = await marketService.getYearlyCumulative(marketName, today);
      }

      setTrendData(currentData);
      setLastYearData(lastYear);
      setYearlyCumulative(cumulative);
      setLoading(false);
    };

    loadData();
  }, [marketName, periodDays, isCustomPeriod, customStartDate, customEndDate, today, isSeongjuTotal, isWholesaleTotal]);

  // 기간 범위 계산 (chartData용)
  const dateRange = useMemo(() => {
    if (isCustomPeriod && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate };
    }
    return getDateRange(periodDays);
  }, [periodDays, isCustomPeriod, customStartDate, customEndDate]);

  // 차트 데이터 생성 (기간 내 모든 날짜를 X축에 표시)
  const chartData = useMemo(() => {
    const { startDate, endDate } = dateRange;

    // 올해 데이터를 날짜별 맵으로
    const currentYearMap = new Map();
    trendData.forEach((item) => {
      const dayMonth = `${new Date(item.market_date).getMonth() + 1}/${new Date(item.market_date).getDate()}`;
      currentYearMap.set(dayMonth, item);
    });

    // 작년 데이터를 날짜별 맵으로
    const lastYearMap = new Map();
    lastYearData.forEach((item) => {
      const dayMonth = `${new Date(item.market_date).getMonth() + 1}/${new Date(item.market_date).getDate()}`;
      lastYearMap.set(dayMonth, item);
    });

    // 기간 내 모든 날짜 생성
    const result = [];
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);

    while (currentDate <= endDateObj) {
      const dayMonth = `${currentDate.getMonth() + 1}/${currentDate.getDate()}`;
      const fullDateStr = currentDate.toISOString().split('T')[0];
      const isTodayDate = fullDateStr === today;
      const dayOfWeek = currentDate.getDay(); // 0: 일요일, 6: 토요일

      const currentItem = currentYearMap.get(dayMonth);
      const lastYearItem = lastYearMap.get(dayMonth);

      result.push({
        date: dayMonth,
        fullDate: fullDateStr,
        isToday: isTodayDate,
        isFuture: fullDateStr > today,
        dayOfWeek, // 요일 정보 추가
        // 올해 가격 데이터 (0이면 null 처리 → connectNulls로 자연스럽게 이어짐)
        maxPrice: currentItem ? (parseInt(currentItem.max_price) || null) : null,
        avgPrice: currentItem ? (parseInt(currentItem.avg_price) || null) : null,
        minPrice: currentItem ? (parseInt(currentItem.min_price) || null) : null,
        // 올해 물량 데이터
        totalBoxes: currentItem ? (parseInt(currentItem.total_boxes) || null) : null,
        totalAmount: currentItem ? (parseInt(currentItem.total_amount) || null) : null,
        // 작년 가격 데이터
        lastYearMax: lastYearItem ? (parseInt(lastYearItem.max_price) || null) : null,
        lastYearAvg: lastYearItem ? (parseInt(lastYearItem.avg_price) || null) : null,
        lastYearMin: lastYearItem ? (parseInt(lastYearItem.min_price) || null) : null,
        // 작년 물량 데이터
        lastYearBoxes: lastYearItem ? (parseInt(lastYearItem.total_boxes) || null) : null,
        lastYearAmount: lastYearItem ? (parseInt(lastYearItem.total_amount) || null) : null,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }, [trendData, lastYearData, today, dateRange]);

  // 오늘 날짜의 X축 값 찾기
  const todayXValue = useMemo(() => {
    const todayItem = chartData.find((item) => item.isToday);
    return todayItem?.date || null;
  }, [chartData]);

  // 커스텀 X축 tick (요일/공휴일별 색상)
  const CustomXAxisTick = ({ x, y, payload }) => {
    const item = chartData.find((d) => d.date === payload.value);
    const dayOfWeek = item?.dayOfWeek;
    const fullDate = item?.fullDate;

    let fill = '#374151'; // 기본 회색
    if (dayOfWeek === 0 || isHoliday(fullDate)) fill = '#dc2626'; // 일요일/공휴일: 빨간색
    else if (dayOfWeek === 6) fill = '#2563eb'; // 토요일: 파란색

    return (
      <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill={fill}>
        {payload.value}
      </text>
    );
  };

  // 기간 버튼 클릭
  const handlePeriodChange = (days) => {
    setIsCustomPeriod(false);
    setPeriodDays(days);
  };

  // 직접 설정 완료
  const handleCustomDateSelect = (date) => {
    if (!customStartDate) {
      setCustomStartDate(date);
    } else {
      // 시작일보다 이전이면 시작일로 설정
      if (date < customStartDate) {
        setCustomEndDate(customStartDate);
        setCustomStartDate(date);
      } else {
        setCustomEndDate(date);
      }
      setShowDatePicker(false);
      setIsCustomPeriod(true);
    }
  };

  // 가격 포맷
  const formatPrice = (value) => {
    if (!value) return '';
    return value.toLocaleString();
  };

  // 커스텀 툴팁
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload;

    return (
      <div className="bg-base-100 p-3 rounded-lg shadow-lg border border-base-300">
        <p className="font-bold text-base-content mb-2">{data?.fullDate}</p>
        <div className="space-y-1 text-sm">
          <p className="text-red-600">
            최고가: {formatPrice(data?.maxPrice)}원
            {data?.lastYearMax && (
              <span className="text-base-content/40 ml-2">
                (작년 {formatPrice(data?.lastYearMax)})
              </span>
            )}
          </p>
          <p className="text-base-content">
            평균가: {formatPrice(data?.avgPrice)}원
            {data?.lastYearAvg && (
              <span className="text-base-content/40 ml-2">
                (작년 {formatPrice(data?.lastYearAvg)})
              </span>
            )}
          </p>
          <p className="text-blue-600">
            최저가: {formatPrice(data?.minPrice)}원
            {data?.lastYearMin && (
              <span className="text-base-content/40 ml-2">
                (작년 {formatPrice(data?.lastYearMin)})
              </span>
            )}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-base-200 pt-14 pb-20">
      {/* 서브 헤더 (뒤로가기 + 제목) */}
      <div className="bg-base-100 border-b border-base-300 sticky top-14 z-10">
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-base-200 rounded-full transition-colors"
          >
            <ArrowBackIcon />
          </button>
          <h1 className="ml-2 text-lg font-bold text-base-content">
            {marketName} 경락가 추세
          </h1>
        </div>
      </div>

      {/* 기간 선택 탭 */}
      <div className="bg-base-100 border-b border-base-300 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { days: 7, label: '7일' },
            { days: 30, label: '30일' },
            { days: 90, label: '90일' },
          ].map(({ days, label }) => (
            <button
              key={days}
              onClick={() => handlePeriodChange(days)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                !isCustomPeriod && periodDays === days
                  ? 'bg-blue-600 text-white'
                  : 'bg-base-200 text-base-content/70 hover:bg-base-300'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => {
              setCustomStartDate(null);
              setCustomEndDate(null);
              setShowDatePicker(true);
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
              isCustomPeriod
                ? 'bg-blue-600 text-white'
                : 'bg-base-200 text-base-content/70 hover:bg-base-300'
            }`}
          >
            <CalendarMonthIcon style={{ fontSize: 18 }} />
            직접설정
          </button>
        </div>

        {/* 선택된 기간 표시 */}
        {isCustomPeriod && customStartDate && customEndDate && (
          <p className="text-sm text-base-content/60 mt-2">
            {customStartDate} ~ {customEndDate}
          </p>
        )}
      </div>

      {/* 차트 영역 */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-base-content/50">
            <div className="text-4xl mb-4">📊</div>
            <p>해당 기간의 경락가 데이터가 없습니다</p>
          </div>
        ) : (
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-4">
            {/* 차트 제목 - 공판장명 */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-base-content">
                📈 {marketName}
              </h2>
              <span className="text-sm text-base-content/50">
                {chartData.length > 0 && `${chartData[0]?.fullDate} ~ ${chartData[chartData.length - 1]?.fullDate}`}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart
                data={chartData}
                margin={{ top: 30, right: 10, left: -10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={<CustomXAxisTick />}
                  tickLine={false}
                  axisLine={{ stroke: '#e0e0e0' }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e0e0e0' }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* 오늘 날짜 수직선 */}
                {todayXValue && (
                  <ReferenceLine
                    x={todayXValue}
                    stroke="#16a34a"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: '오늘',
                      position: 'top',
                      fill: '#16a34a',
                      fontSize: 11,
                      fontWeight: 'bold',
                    }}
                  />
                )}

                {/* 올해 데이터 - 굵은 실선 */}
                <Line
                  type="monotone"
                  dataKey="maxPrice"
                  name="올해 최고"
                  stroke="#dc2626"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls={true}
                />
                <Line
                  type="monotone"
                  dataKey="avgPrice"
                  name="올해 평균"
                  stroke="#1f2937"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls={true}
                />
                <Line
                  type="monotone"
                  dataKey="minPrice"
                  name="올해 최저"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls={true}
                />

                {/* 작년 데이터 - 점선 (연한 색상) */}
                <Line
                  type="monotone"
                  dataKey="lastYearMax"
                  name="작년 최고"
                  stroke="#fca5a5"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={true}
                />
                <Line
                  type="monotone"
                  dataKey="lastYearAvg"
                  name="작년 평균"
                  stroke="#9ca3af"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={true}
                />
                <Line
                  type="monotone"
                  dataKey="lastYearMin"
                  name="작년 최저"
                  stroke="#93c5fd"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* 범례 설명 */}
            <div className="mt-4 pt-4 border-t border-base-200 text-xs text-base-content/60 space-y-2">
              {/* 올해 */}
              <div className="flex items-center justify-center gap-4">
                <span className="font-medium">올해</span>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-1 bg-red-600 rounded"></div>
                  <span>최고</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-1 bg-gray-800 rounded"></div>
                  <span>평균</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-1 bg-blue-600 rounded"></div>
                  <span>최저</span>
                </div>
              </div>
              {/* 작년 */}
              <div className="flex items-center justify-center gap-4">
                <span className="font-medium">작년</span>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-0.5" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #fca5a5 0, #fca5a5 3px, transparent 3px, transparent 6px)' }}></div>
                  <span>최고</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-0.5" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #9ca3af 0, #9ca3af 3px, transparent 3px, transparent 6px)' }}></div>
                  <span>평균</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-0.5" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #93c5fd 0, #93c5fd 3px, transparent 3px, transparent 6px)' }}></div>
                  <span>최저</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 물량 차트 */}
        {!loading && chartData.length > 0 && (
          <div className="mt-4 bg-base-100 rounded-2xl shadow-sm border border-base-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-base-content">
                📦 물량 추이
              </h2>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={chartData}
                margin={{ top: 30, right: 10, left: -10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={<CustomXAxisTick />}
                  tickLine={false}
                  axisLine={{ stroke: '#e0e0e0' }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e0e0e0' }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0]?.payload;
                    return (
                      <div className="bg-base-100 p-3 rounded-lg shadow-lg border border-base-300">
                        <p className="font-bold text-base-content mb-2">{data?.fullDate}</p>
                        <div className="space-y-1 text-sm">
                          <p className="text-emerald-600">
                            올해 물량: {data?.totalBoxes?.toLocaleString() || '-'}박스
                          </p>
                          {data?.lastYearBoxes && (
                            <p className="text-base-content/50">
                              작년 물량: {data?.lastYearBoxes?.toLocaleString()}박스
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />

                {/* 오늘 날짜 수직선 */}
                {todayXValue && (
                  <ReferenceLine
                    x={todayXValue}
                    stroke="#16a34a"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: '오늘',
                      position: 'top',
                      fill: '#16a34a',
                      fontSize: 11,
                      fontWeight: 'bold',
                    }}
                  />
                )}

                {/* 올해 물량 */}
                <Line
                  type="monotone"
                  dataKey="totalBoxes"
                  name="올해 물량"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls={true}
                />

                {/* 작년 물량 */}
                <Line
                  type="monotone"
                  dataKey="lastYearBoxes"
                  name="작년 물량"
                  stroke="#6ee7b7"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* 범례 */}
            <div className="mt-4 pt-4 border-t border-base-200 text-xs text-base-content/60">
              <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-1 bg-emerald-500 rounded"></div>
                  <span>올해</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #6ee7b7 0, #6ee7b7 3px, transparent 3px, transparent 6px)' }}></div>
                  <span>작년</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 데이터 요약 카드 */}
        {!loading && chartData.length > 0 && (() => {
          // 올해 데이터 (데이터가 있는 날짜만)
          const validData = chartData.filter((d) => d.maxPrice !== null && d.maxPrice > 0);
          if (validData.length === 0) return null;

          const maxPrice = Math.max(...validData.map((d) => d.maxPrice));
          const avgPrices = validData.filter((d) => d.avgPrice && d.avgPrice > 0);
          const avgPrice = avgPrices.length > 0
            ? Math.round(avgPrices.reduce((sum, d) => sum + d.avgPrice, 0) / avgPrices.length)
            : 0;
          const minPrices = validData.filter((d) => d.minPrice && d.minPrice > 0);
          const minPrice = minPrices.length > 0
            ? Math.min(...minPrices.map((d) => d.minPrice))
            : 0;

          // 작년 데이터 (오늘까지 해당하는 날짜만 - 미래 날짜의 작년 데이터 제외)
          const lastYearValid = chartData.filter((d) => !d.isFuture && d.lastYearMax !== null && d.lastYearMax > 0);
          const lastYearMaxPrice = lastYearValid.length > 0
            ? Math.max(...lastYearValid.map((d) => d.lastYearMax))
            : 0;
          const lastYearAvgPrices = chartData.filter((d) => !d.isFuture && d.lastYearAvg && d.lastYearAvg > 0);
          const lastYearAvgPrice = lastYearAvgPrices.length > 0
            ? Math.round(lastYearAvgPrices.reduce((sum, d) => sum + d.lastYearAvg, 0) / lastYearAvgPrices.length)
            : 0;
          const lastYearMinPrices = chartData.filter((d) => !d.isFuture && d.lastYearMin && d.lastYearMin > 0);
          const lastYearMinPrice = lastYearMinPrices.length > 0
            ? Math.min(...lastYearMinPrices.map((d) => d.lastYearMin))
            : 0;

          return (
            <div className="mt-4 bg-base-100 rounded-2xl shadow-sm border border-base-200 p-4">
              {/* 올해 요약 */}
              <h3 className="font-bold text-base-content mb-3">기간 요약 (올해)</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-xs text-red-600 mb-1">최고가</p>
                  <p className="text-lg font-bold text-red-600">
                    {formatPrice(maxPrice)}
                  </p>
                </div>
                <div className="bg-base-200 rounded-xl p-3">
                  <p className="text-xs text-base-content/60 mb-1">평균가</p>
                  <p className="text-lg font-bold text-base-content">
                    {formatPrice(avgPrice)}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-blue-600 mb-1">최저가</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatPrice(minPrice)}
                  </p>
                </div>
              </div>

              {/* 작년 동기 요약 */}
              {lastYearMaxPrice > 0 && (
                <>
                  <h3 className="font-bold text-base-content/60 mb-3 mt-4 pt-4 border-t border-base-200">작년 동기</h3>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-orange-50 rounded-xl p-3">
                      <p className="text-xs text-orange-600 mb-1">최고가</p>
                      <p className="text-lg font-bold text-orange-600">
                        {formatPrice(lastYearMaxPrice)}
                      </p>
                    </div>
                    <div className="bg-base-300 rounded-xl p-3">
                      <p className="text-xs text-base-content/60 mb-1">평균가</p>
                      <p className="text-lg font-bold text-base-content/60">
                        {formatPrice(lastYearAvgPrice)}
                      </p>
                    </div>
                    <div className="bg-cyan-50 rounded-xl p-3">
                      <p className="text-xs text-cyan-600 mb-1">최저가</p>
                      <p className="text-lg font-bold text-cyan-600">
                        {formatPrice(lastYearMinPrice)}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* 연간 누적 출하량/금액 비교 (1월1일~오늘 vs 작년 동기) */}
        {!loading && yearlyCumulative && (() => {
          const { thisYear, lastYear } = yearlyCumulative;
          if (thisYear.boxes === 0 && lastYear.boxes === 0) return null;

          const boxDiff = thisYear.boxes - lastYear.boxes;
          const boxDiffPct = lastYear.boxes > 0 ? ((boxDiff / lastYear.boxes) * 100).toFixed(1) : null;

          const amtDiff = thisYear.amount - lastYear.amount;
          const amtDiffPct = lastYear.amount > 0 ? ((amtDiff / lastYear.amount) * 100).toFixed(1) : null;

          const formatMillion = (v) => {
            const abs = Math.abs(v);
            if (abs >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
            return `${Math.round(v / 1000000).toLocaleString()}백만`;
          };

          const year = parseInt(today.slice(0, 4));

          return (
            <>
              {/* 누적 출하량 */}
              <div className="mt-4 bg-base-100 rounded-2xl shadow-sm border border-base-200 p-4">
                <h3 className="font-bold text-base-content mb-3">연간 누적 출하량</h3>
                <p className="text-xs text-base-content/40 -mt-2 mb-3">{year}.01.01 ~ 오늘</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-base-content/60">{year}년</span>
                    <span className="text-base font-bold text-base-content">{thisYear.boxes.toLocaleString()}상자</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-base-200">
                    <span className="text-sm text-base-content/50">{year - 1}년 동기</span>
                    <span className="text-base font-bold text-base-content/50">{lastYear.boxes.toLocaleString()}상자</span>
                  </div>
                  {lastYear.boxes > 0 && (
                    <div className="flex items-center justify-between py-2 border-t border-base-300">
                      <span className="text-sm text-base-content/60">전년 대비</span>
                      <span className={`text-base font-bold ${
                        boxDiff > 0 ? 'text-red-600' : boxDiff < 0 ? 'text-blue-600' : 'text-base-content/60'
                      }`}>
                        {boxDiff > 0 ? '+' : ''}{boxDiff.toLocaleString()}상자
                        {boxDiffPct && ` (${boxDiff > 0 ? '+' : ''}${boxDiffPct}%)`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 누적 출하금액 */}
              {(thisYear.amount > 0 || lastYear.amount > 0) && (
                <div className="mt-4 bg-base-100 rounded-2xl shadow-sm border border-base-200 p-4">
                  <h3 className="font-bold text-base-content mb-3">연간 누적 출하금액</h3>
                  <p className="text-xs text-base-content/40 -mt-2 mb-3">{year}.01.01 ~ 오늘</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-base-content/60">{year}년</span>
                      <span className="text-base font-bold text-base-content">{formatMillion(thisYear.amount)}원</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-t border-base-200">
                      <span className="text-sm text-base-content/50">{year - 1}년 동기</span>
                      <span className="text-base font-bold text-base-content/50">{formatMillion(lastYear.amount)}원</span>
                    </div>
                    {lastYear.amount > 0 && (
                      <div className="flex items-center justify-between py-2 border-t border-base-300">
                        <span className="text-sm text-base-content/60">전년 대비</span>
                        <span className={`text-base font-bold ${
                          amtDiff > 0 ? 'text-red-600' : amtDiff < 0 ? 'text-blue-600' : 'text-base-content/60'
                        }`}>
                          {amtDiff > 0 ? '+' : ''}{formatMillion(amtDiff)}원
                          {amtDiffPct && ` (${amtDiff > 0 ? '+' : ''}${amtDiffPct}%)`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* 날짜 선택 모달 */}
      <DatePickerModal
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={customStartDate || today}
        onSelectDate={handleCustomDateSelect}
        maxDate={today}
        title={customStartDate ? '종료 날짜 선택' : '시작 날짜 선택'}
      />
    </div>
  );
};

export default MarketTrend;
