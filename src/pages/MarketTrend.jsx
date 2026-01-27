import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { marketService } from '../services';
import LoadingSpinner from '../components/LoadingSpinner';
import DatePickerModal from '../components/DatePickerModal';

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

      // 올해 데이터
      const currentData = await marketService.getMarketTrendData(
        marketName,
        startDate,
        endDate
      );

      // 작년 동기 데이터
      const lastYearRange = getLastYearRange(startDate, endDate);
      const lastYear = await marketService.getMarketTrendData(
        marketName,
        lastYearRange.startDate,
        lastYearRange.endDate
      );

      setTrendData(currentData);
      setLastYearData(lastYear);
      setLoading(false);
    };

    loadData();
  }, [marketName, periodDays, isCustomPeriod, customStartDate, customEndDate]);

  // 차트 데이터 병합 (올해 + 작년)
  const chartData = useMemo(() => {
    if (!trendData || trendData.length === 0) return [];

    // 올해 데이터를 기준으로 작년 데이터 매핑
    return trendData.map((item, index) => {
      const date = new Date(item.market_date);
      const dayMonth = `${date.getMonth() + 1}/${date.getDate()}`;
      const isToday = item.market_date === today;

      // 작년 동일 인덱스 데이터 찾기
      const lastYearItem = lastYearData[index] || {};

      return {
        date: dayMonth,
        fullDate: item.market_date,
        isToday,
        // 올해 데이터
        maxPrice: parseInt(item.max_price) || 0,
        avgPrice: parseInt(item.avg_price) || 0,
        minPrice: parseInt(item.min_price) || 0,
        // 작년 데이터
        lastYearMax: parseInt(lastYearItem.max_price) || null,
        lastYearAvg: parseInt(lastYearItem.avg_price) || null,
        lastYearMin: parseInt(lastYearItem.min_price) || null,
      };
    });
  }, [trendData, lastYearData, today]);

  // 오늘 날짜의 X축 값 찾기
  const todayXValue = useMemo(() => {
    const todayItem = chartData.find((item) => item.isToday);
    return todayItem?.date || null;
  }, [chartData]);

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
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-bold text-gray-800 mb-2">{data?.fullDate}</p>
        <div className="space-y-1 text-sm">
          <p className="text-red-600">
            최고가: {formatPrice(data?.maxPrice)}원
            {data?.lastYearMax && (
              <span className="text-gray-400 ml-2">
                (작년 {formatPrice(data?.lastYearMax)})
              </span>
            )}
          </p>
          <p className="text-gray-800">
            평균가: {formatPrice(data?.avgPrice)}원
            {data?.lastYearAvg && (
              <span className="text-gray-400 ml-2">
                (작년 {formatPrice(data?.lastYearAvg)})
              </span>
            )}
          </p>
          <p className="text-blue-600">
            최저가: {formatPrice(data?.minPrice)}원
            {data?.lastYearMin && (
              <span className="text-gray-400 ml-2">
                (작년 {formatPrice(data?.lastYearMin)})
              </span>
            )}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowBackIcon />
          </button>
          <h1 className="ml-2 text-lg font-bold text-gray-800">
            {marketName} 경락가 추세
          </h1>
        </div>
      </div>

      {/* 기간 선택 탭 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
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
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <CalendarMonthIcon style={{ fontSize: 18 }} />
            직접설정
          </button>
        </div>

        {/* 선택된 기간 표시 */}
        {isCustomPeriod && customStartDate && customEndDate && (
          <p className="text-sm text-gray-600 mt-2">
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
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <div className="text-4xl mb-4">📊</div>
            <p>해당 기간의 경락가 데이터가 없습니다</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            {/* 차트 제목 - 공판장명 */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">
                📈 {marketName}
              </h2>
              <span className="text-sm text-gray-500">
                {chartData.length > 0 && `${chartData[0]?.fullDate} ~ ${chartData[chartData.length - 1]?.fullDate}`}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
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
                <Legend
                  wrapperStyle={{ paddingTop: 20 }}
                  formatter={(value) => (
                    <span className="text-xs">{value}</span>
                  )}
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

                {/* 올해 데이터 - 실선 */}
                <Line
                  type="monotone"
                  dataKey="maxPrice"
                  name="최고가"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="avgPrice"
                  name="평균가"
                  stroke="#374151"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="minPrice"
                  name="최저가"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />

                {/* 작년 데이터 - 점선 */}
                <Line
                  type="monotone"
                  dataKey="lastYearMax"
                  name="작년 최고"
                  stroke="#dc2626"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  opacity={0.5}
                />
                <Line
                  type="monotone"
                  dataKey="lastYearAvg"
                  name="작년 평균"
                  stroke="#374151"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  opacity={0.5}
                />
                <Line
                  type="monotone"
                  dataKey="lastYearMin"
                  name="작년 최저"
                  stroke="#2563eb"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  opacity={0.5}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* 범례 설명 */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 bg-red-600"></div>
                  <span>올해</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-0.5 bg-red-600"
                    style={{
                      backgroundImage:
                        'linear-gradient(90deg, #dc2626 50%, transparent 50%)',
                      backgroundSize: '6px 1px',
                    }}
                  ></div>
                  <span>작년 동기</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 데이터 요약 카드 */}
        {!loading && chartData.length > 0 && (
          <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-bold text-gray-800 mb-3">기간 요약</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-xs text-red-600 mb-1">최고가</p>
                <p className="text-lg font-bold text-red-600">
                  {formatPrice(Math.max(...chartData.map((d) => d.maxPrice)))}
                </p>
                <p className="text-xs text-gray-500">원</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">평균가</p>
                <p className="text-lg font-bold text-gray-800">
                  {formatPrice(
                    Math.round(
                      chartData.reduce((sum, d) => sum + d.avgPrice, 0) /
                        chartData.length
                    )
                  )}
                </p>
                <p className="text-xs text-gray-500">원</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-600 mb-1">최저가</p>
                <p className="text-lg font-bold text-blue-600">
                  {formatPrice(
                    Math.min(...chartData.filter((d) => d.minPrice > 0).map((d) => d.minPrice))
                  )}
                </p>
                <p className="text-xs text-gray-500">원</p>
              </div>
            </div>
          </div>
        )}
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
