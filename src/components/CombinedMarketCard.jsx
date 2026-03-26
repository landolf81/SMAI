/**
 * CombinedMarketCard.jsx
 * 홈 화면 최하단 - 산지 + 도매(익일) 종합 카드
 *
 * 표시 규칙:
 * - 항상 산지(baseDate) + 도매(baseDate+1) 쌍으로만 표시
 * - baseDate: selectedDate >= 오늘이면 selectedDate-1, 아니면 selectedDate
 * - seongjuOnly / isTodayOnly 모드 없음
 * - 전년 비교: 항상 산지+도매 합산
 * - 14일 추세 차트 (baseDate 기준) + 전년 오버레이
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  Legend,
  ComposedChart,
} from 'recharts';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { marketCombinedService } from '../services';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const getDayOfWeek = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

const formatShortDate = (dateStr) => dateStr ? dateStr.slice(5).replace('-', '/') : '';

const getKoreanToday = () => {
  const now = new Date();
  const k = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${k.getFullYear()}-${String(k.getMonth() + 1).padStart(2, '0')}-${String(k.getDate()).padStart(2, '0')}`;
};

const getNextDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const getPrevDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

// 커스텀 툴팁
const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const dayName = DAY_NAMES[getDayOfWeek(d.market_date)];

  return (
    <div className="bg-base-100 border border-base-300 rounded-lg shadow-lg p-2.5 text-xs min-w-[150px]">
      <div className="font-bold text-base-content mb-1">
        산지 {d.market_date} ({dayName})
        {d.wholesale_date && (
          <span className="text-purple-600 ml-1">
            + 도매 {formatShortDate(d.wholesale_date)}
          </span>
        )}
      </div>
      <div className="text-emerald-600">
        평균가: <span className="font-bold">{(d.avg_price || 0).toLocaleString()}원</span>
      </div>
      <div className="text-blue-600 mt-0.5">
        산지: {(d.seongju_boxes || 0).toLocaleString()}상자
      </div>
      {d.hasWholesale && (
        <div className="text-purple-600 mt-0.5">
          도매(익일): {(d.wholesale_boxes || 0).toLocaleString()}상자
        </div>
      )}
      {d.isFuture && (
        <div className="text-orange-500 mt-0.5 font-medium">미래 (작년 참고)</div>
      )}
      {/* 작년 비교 */}
      {d.lastYear_avg_price != null && (
        <div className="mt-1.5 pt-1.5 border-t border-base-300">
          <div className="text-base-content/50 mb-0.5">
            작년 {d.lastYear_date ? formatShortDate(d.lastYear_date) : ''} ({dayName}) +도매
          </div>
          <div className="text-amber-600">
            평균가: <span className="font-bold">{d.lastYear_avg_price.toLocaleString()}원</span>
          </div>
          {d.lastYear_total_boxes != null && (
            <div className="text-amber-600/70">
              출하량: {d.lastYear_total_boxes.toLocaleString()}상자
            </div>
          )}
          {d.avg_price > 0 && d.lastYear_avg_price > 0 && (
            <div
              className={`mt-0.5 font-bold ${
                d.avg_price > d.lastYear_avg_price ? 'text-red-600' : 'text-blue-600'
              }`}
            >
              전년比 {d.avg_price > d.lastYear_avg_price ? '▲' : '▼'}{' '}
              {Math.abs(d.avg_price - d.lastYear_avg_price).toLocaleString()}원
              ({((d.avg_price - d.lastYear_avg_price) / d.lastYear_avg_price * 100).toFixed(1)}%)
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * @param {string} selectedDate - 홈에서 선택된 날짜 (YYYY-MM-DD)
 * @param {Function} formatPrice - 숫자 포맷 함수
 */
const CombinedMarketCard = ({ selectedDate, formatPrice }) => {
  const [expanded, setExpanded] = useState(false);
  const [chartType, setChartType] = useState('price');
  const scrollRef = useRef(null);

  // 기준일 결정: 오늘 이상이면 전일(어제 산지 + 오늘 도매), 아니면 선택일
  const today = getKoreanToday();
  const baseDate = selectedDate >= today ? getPrevDate(selectedDate) : selectedDate;
  const wholesaleDate = getNextDate(baseDate);

  // 산지 데이터 조회 (기준일)
  const { data: seongjuData } = useQuery({
    queryKey: ['combinedSeonju', baseDate],
    queryFn: () => marketCombinedService.getSeongjuForDate(baseDate),
    staleTime: 5 * 60 * 1000,
  });

  // 도매(익일) 데이터 조회
  const { data: wholesaleData } = useQuery({
    queryKey: ['combinedWholesale', wholesaleDate],
    queryFn: () => marketCombinedService.getWholesaleForDate(wholesaleDate),
    staleTime: 5 * 60 * 1000,
  });

  // 작년 비교 데이터 — 항상 산지+도매 합산
  const { data: lastYearData } = useQuery({
    queryKey: ['lastYearComparison', baseDate],
    queryFn: () => marketCombinedService.getLastYearComparison(baseDate),
    staleTime: 10 * 60 * 1000,
  });

  // 추세 차트 날짜 범위: baseDate 기준 앞 18일 + 뒤 5일 (스크롤 여유)
  const dateRange = useMemo(() => {
    const [y, m, d] = baseDate.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    const end = new Date(base);
    end.setDate(end.getDate() + 5); // 미래 5일 (작년 데이터만)
    const start = new Date(base);
    start.setDate(start.getDate() - 18); // 과거 18일
    const f = (dt) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    return { start: f(start), end: f(end) };
  }, [baseDate]);

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['combinedTrend', dateRange.start, dateRange.end],
    queryFn: () => marketCombinedService.getCombinedTrendData(dateRange.start, dateRange.end),
    staleTime: 5 * 60 * 1000,
    enabled: expanded,
  });

  // 차트 데이터 수, 포인트당 너비
  const POINT_WIDTH = 38; // px per data point
  const chartWidth = trendData ? Math.max(trendData.length * POINT_WIDTH, 320) : 320;

  // 차트 로드 시 baseDate 위치로 스크롤
  const scrollToBase = useCallback(() => {
    if (!scrollRef.current || !trendData?.length) return;
    // baseDate에 해당하는 인덱스 찾기
    const baseIdx = trendData.findIndex(d => d.market_date === baseDate);
    if (baseIdx < 0) return;
    // baseDate가 화면 오른쪽 끝에 오도록
    const containerWidth = scrollRef.current.clientWidth;
    const targetX = (baseIdx + 1) * POINT_WIDTH - containerWidth;
    scrollRef.current.scrollLeft = Math.max(0, targetX);
  }, [trendData, baseDate]);

  useEffect(() => {
    if (trendData?.length) {
      requestAnimationFrame(scrollToBase);
    }
  }, [trendData, scrollToBase]);

  // 합산 계산
  const combined = useMemo(() => {
    if (!seongjuData) return null;
    const sBoxes = seongjuData.total_boxes || 0;
    const sAmount = seongjuData.total_amount || 0;
    const wBoxes = wholesaleData?.total_boxes || 0;
    const wAmount = wholesaleData?.total_amount || 0;
    const totalBoxes = sBoxes + wBoxes;
    const totalAmount = sAmount + wAmount;
    return {
      totalBoxes,
      totalAmount,
      avgPrice: totalBoxes > 0 ? Math.round(totalAmount / totalBoxes) : 0,
      seongjuBoxes: sBoxes,
      wholesaleBoxes: wBoxes,
      hasWholesale: wBoxes > 0,
    };
  }, [seongjuData, wholesaleData]);

  if (!combined) return null;

  const dayOfWeek = getDayOfWeek(baseDate);
  const dayName = DAY_NAMES[dayOfWeek];

  // 등락 표시 헬퍼
  const renderChange = (current, previous, showPct = false, asMillion = false) => {
    if (!previous || previous === 0) return null;
    const rawChange = current - previous;
    const change = Math.sign(rawChange) * Math.floor(Math.abs(rawChange) / 10) * 10;
    if (change === 0) return <span className="text-base-content/50 text-sm">보합</span>;
    const isUp = change > 0;
    const pct = showPct ? ` (${((change / previous) * 100).toFixed(1)}%)` : '';
    const displayVal = asMillion
      ? `${(Math.abs(change) / 1000000).toLocaleString('ko-KR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}백만`
      : Math.abs(change).toLocaleString();
    return (
      <span className={`text-sm font-bold ${isUp ? 'text-red-600' : 'text-blue-600'}`}>
        {isUp ? '▲' : '▼'} {displayVal}{pct}
      </span>
    );
  };

  // 산지/도매 비율
  const seongjuPct = combined.totalBoxes > 0
    ? Math.round((combined.seongjuBoxes / combined.totalBoxes) * 100)
    : 100;
  const wholesalePct = 100 - seongjuPct;

  return (
    <div className="w-full mx-auto mt-6">
      <div className="rounded-2xl overflow-hidden shadow-lg border border-base-200 bg-base-100">
        {/* 헤더 */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #059669, #1D4ED8, #7C3AED)' }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
            <span className="text-white font-bold text-lg">산지 + 도매(익일)</span>
            <span className="text-white/60 text-sm">({dayName})</span>
          </div>
        </div>

        {/* 본문 */}
        <div className="px-4 py-4">
          {/* 날짜 안내 — 항상 표시 */}
          <div className="text-sm text-base-content/50 mb-2">
            산지 {baseDate} + 도매 {wholesaleDate}
          </div>

          {/* 총 출하량 */}
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-base-content/60 text-base">총 출하량</span>
            <span className="text-2xl font-bold text-base-content">
              {formatPrice(combined.totalBoxes)}
            </span>
            <span className="text-sm text-base-content/50">상자</span>
          </div>

          {/* 총 출하금액 */}
          <div className="text-base text-base-content/60 mb-4">
            총 출하금액{' '}
            <span className="font-bold text-base-content text-lg">
              {(combined.totalAmount / 1000000).toLocaleString('ko-KR', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </span>{' '}
            <span className="text-sm text-base-content/50">백만원</span>
          </div>

          {/* 가중평균가 */}
          <div className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 rounded-xl p-4 mb-4">
            <div className="text-sm text-base-content/50 mb-1">가중평균가 (합산)</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatPrice(combined.avgPrice)}
              </span>
              <span className="text-base text-base-content/50">원</span>
            </div>
          </div>

          {/* 산지/도매 비율 바 */}
          {combined.hasWholesale && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-base-content/60 mb-1">
                <span>산지 {seongjuPct}%</span>
                <span>도매(익일) {wholesalePct}%</span>
              </div>
              <div className="h-3 bg-base-200 rounded-full overflow-hidden flex">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-400 rounded-l-full transition-all duration-500"
                  style={{ width: `${seongjuPct}%` }}
                />
                <div
                  className="bg-gradient-to-r from-purple-400 to-purple-500 rounded-r-full transition-all duration-500"
                  style={{ width: `${wholesalePct}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-base-content/40 mt-0.5">
                <span>{formatPrice(combined.seongjuBoxes)}상자</span>
                <span>{formatPrice(combined.wholesaleBoxes)}상자</span>
              </div>
            </div>
          )}

          {/* 작년 비교 */}
          {lastYearData && (
            <div className="bg-base-200/50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-sm font-bold text-base-content/70">작년 비교</span>
                <span className="text-sm text-base-content/40">
                  ({lastYearData.date} {DAY_NAMES[getDayOfWeek(lastYearData.date)]} +도매)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-sm text-base-content/50 mb-1">평균가</div>
                  <div className="text-lg font-bold text-base-content">
                    {formatPrice(lastYearData.avgPrice)}
                  </div>
                  <div className="mt-1">
                    {renderChange(combined.avgPrice, lastYearData.avgPrice, true)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-base-content/50 mb-1">출하량</div>
                  <div className="text-lg font-bold text-base-content">
                    {formatPrice(lastYearData.totalBoxes)}
                  </div>
                  <div className="mt-1">
                    {renderChange(combined.totalBoxes, lastYearData.totalBoxes, true)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-base-content/50 mb-1">출하금액</div>
                  <div className="text-lg font-bold text-base-content">
                    {(lastYearData.totalAmount / 1000000).toLocaleString('ko-KR', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    <span className="text-xs text-base-content/50 ml-0.5">백만</span>
                  </div>
                  <div className="mt-1">
                    {renderChange(combined.totalAmount, lastYearData.totalAmount, true, true)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 차트 토글 */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1 py-2 text-sm text-base-content/60 hover:text-base-content transition-colors"
          >
            <span>{expanded ? '차트 접기' : '추세 차트 보기'}</span>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </button>

          {/* 확장 차트 — 좌우 스크롤 */}
          {expanded && (
            <div className="mt-2">
              <div className="flex gap-1 mb-3">
                <button
                  onClick={() => setChartType('price')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    chartType === 'price'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-base-200 text-base-content/60'
                  }`}
                >
                  평균가 추세
                </button>
                <button
                  onClick={() => setChartType('volume')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    chartType === 'volume'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-base-200 text-base-content/60'
                  }`}
                >
                  출하량 비교
                </button>
              </div>

              {/* 스크롤 안내 */}
              <div className="text-center text-xs text-base-content/40 mb-1">
                ← 좌우 스크롤 →
              </div>

              {trendLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : trendData && trendData.length > 0 ? (
                <div
                  ref={scrollRef}
                  className="overflow-x-auto overflow-y-hidden scrollbar-hide"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <div style={{ width: chartWidth, height: 224 }}>
                    {chartType === 'price' ? (
                      <ComposedChart
                        width={chartWidth}
                        height={224}
                        data={trendData}
                        margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="combinedGradAvg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis
                          dataKey="market_date"
                          tickFormatter={formatShortDate}
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                          tickLine={false}
                          axisLine={false}
                          domain={['dataMin - 1000', 'dataMax + 1000']}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend
                          verticalAlign="top"
                          height={24}
                          iconSize={8}
                          wrapperStyle={{ fontSize: 10 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="avg_price"
                          name="올해"
                          stroke="#059669"
                          strokeWidth={2.5}
                          fill="url(#combinedGradAvg)"
                          dot={{ r: 3, fill: '#059669', strokeWidth: 0 }}
                          activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="lastYear_avg_price"
                          name="작년"
                          stroke="#D97706"
                          strokeWidth={1.5}
                          strokeDasharray="6 3"
                          dot={{ r: 2, fill: '#D97706', strokeWidth: 0 }}
                          activeDot={{ r: 4, stroke: '#fff', strokeWidth: 1.5 }}
                          connectNulls={false}
                        />
                      </ComposedChart>
                    ) : (
                      <ComposedChart
                        width={chartWidth}
                        height={224}
                        data={trendData}
                        margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis
                          dataKey="market_date"
                          tickFormatter={formatShortDate}
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend
                          verticalAlign="top"
                          height={24}
                          iconSize={8}
                          wrapperStyle={{ fontSize: 10 }}
                        />
                        <Bar
                          dataKey="seongju_boxes"
                          name="산지"
                          stackId="vol"
                          fill="#3B82F6"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="wholesale_boxes"
                          name="도매(익일)"
                          stackId="vol"
                          fill="#8B5CF6"
                          radius={[4, 4, 0, 0]}
                        />
                        <Line
                          type="monotone"
                          dataKey="lastYear_total_boxes"
                          name="작년"
                          stroke="#D97706"
                          strokeWidth={1.5}
                          strokeDasharray="6 3"
                          dot={{ r: 2, fill: '#D97706', strokeWidth: 0 }}
                          connectNulls={false}
                        />
                      </ComposedChart>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-sm text-base-content/40">
                  추세 데이터가 없습니다
                </div>
              )}

              {trendData?.length > 0 && trendData.some(d => d.lastYear_date) && (
                <div className="text-center mt-1.5 text-xs text-base-content/40">
                  기준일=산지, 합산=산지+도매(익일), 미래=작년만, 좌우 스크롤
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CombinedMarketCard;
