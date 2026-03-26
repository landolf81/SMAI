/**
 * CombinedMarketCard.jsx
 * 홈 화면 최하단 - 산지(성주군) + 도매시장 합산 카드
 *
 * 기능:
 * - 성주군 합계 + 도매시장 합계를 합산한 종합 정보 표시
 * - 토요일: 산지 휴장(도매만), 일요일: 도매 휴장(산지만) 표시
 * - 작년 동일 요일 비교 (날짜가 아닌 요일 기준 매칭)
 * - 14일 추세 차트 (평균가 AreaChart + 출하량 BarChart)
 * - 산지/도매 출하량 비율 바
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  ComposedChart,
} from 'recharts';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { marketCombinedService } from '../services';

// 요일 한글
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// 요일 계산 (0=일, 6=토)
const getDayOfWeek = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

// 날짜 포맷 (MM/DD)
const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  return dateStr.slice(5).replace('-', '/');
};

// 커스텀 툴팁 (작년 데이터 포함)
const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const dayName = DAY_NAMES[getDayOfWeek(d.market_date)];

  return (
    <div className="bg-base-100 border border-base-300 rounded-lg shadow-lg p-2.5 text-xs min-w-[150px]">
      <div className="font-bold text-base-content mb-1">
        {d.market_date} ({dayName})
      </div>
      <div className="text-emerald-600">
        평균가: <span className="font-bold">{(d.avg_price || 0).toLocaleString()}원</span>
      </div>
      <div className="text-base-content/70 mt-0.5">
        출하량: {(d.total_boxes || 0).toLocaleString()}상자
      </div>
      {d.hasSeonju && (
        <div className="text-blue-600 mt-0.5">
          산지: {(d.seongju_boxes || 0).toLocaleString()}상자
        </div>
      )}
      {d.hasWholesale && (
        <div className="text-purple-600 mt-0.5">
          도매: {(d.wholesale_boxes || 0).toLocaleString()}상자
        </div>
      )}
      {!d.hasSeonju && <div className="text-orange-500 mt-0.5">산지 휴장</div>}
      {!d.hasWholesale && <div className="text-orange-500 mt-0.5">도매 휴장</div>}
      {/* 작년 비교 */}
      {d.lastYear_avg_price != null && (
        <div className="mt-1.5 pt-1.5 border-t border-base-300">
          <div className="text-base-content/50 mb-0.5">
            작년 {d.lastYear_date ? formatShortDate(d.lastYear_date) : ''} ({dayName})
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
            <div className={`mt-0.5 font-bold ${
              d.avg_price > d.lastYear_avg_price ? 'text-red-600' : 'text-blue-600'
            }`}>
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

const CombinedMarketCard = ({ seongjuTotal, wholesaleTotal, selectedDate, formatPrice }) => {
  const [expanded, setExpanded] = useState(false);
  const [chartType, setChartType] = useState('price'); // 'price' | 'volume'

  // 14일 전 날짜 계산
  const dateRange = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const end = new Date(y, m - 1, d);
    const start = new Date(end);
    start.setDate(start.getDate() - 13);
    const fmt = (dt) => {
      const yy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    };
    return { start: fmt(start), end: fmt(end) };
  }, [selectedDate]);

  // 합산 추세 데이터 (14일)
  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['combinedTrend', dateRange.start, dateRange.end],
    queryFn: () => marketCombinedService.getCombinedTrendData(dateRange.start, dateRange.end),
    staleTime: 5 * 60 * 1000,
    enabled: expanded,
  });

  // 작년 동일 요일 비교 데이터
  const { data: lastYearData } = useQuery({
    queryKey: ['lastYearWeekday', selectedDate],
    queryFn: () => marketCombinedService.getLastYearSameWeekday(selectedDate),
    staleTime: 10 * 60 * 1000,
  });

  // 합산 계산
  const combined = useMemo(() => {
    const s = seongjuTotal;
    const w = wholesaleTotal;

    if (!s && !w) return null;

    const totalBoxes = (s?.totalQuantity || 0) + (w?.totalQuantity || 0);
    const totalAmount = (s?.totalAmount || 0) + (w?.totalAmount || 0);
    const avgPrice = totalBoxes > 0 ? Math.round(totalAmount / totalBoxes) : 0;

    // 전일 합산
    const prevBoxes = (s?.previousTotalQuantity || 0) + (w?.previousTotalQuantity || 0);
    const prevAmount = (() => {
      const sPrevAmt = (s?.previousAveragePrice || 0) * (s?.previousTotalQuantity || 0);
      const wPrevAmt = (w?.previousAveragePrice || 0) * (w?.previousTotalQuantity || 0);
      return sPrevAmt + wPrevAmt;
    })();
    const prevAvg = prevBoxes > 0 ? Math.round(prevAmount / prevBoxes) : 0;

    return {
      totalBoxes,
      totalAmount,
      avgPrice,
      prevBoxes: prevBoxes > 0 ? prevBoxes : null,
      prevAvg: prevAvg > 0 ? prevAvg : null,
      seongjuBoxes: s?.totalQuantity || 0,
      wholesaleBoxes: w?.totalQuantity || 0,
      hasSeonju: !!s && (s.totalQuantity > 0 || s.averagePrice > 0),
      hasWholesale: !!w && (w.totalQuantity > 0 || w.averagePrice > 0),
    };
  }, [seongjuTotal, wholesaleTotal]);

  if (!combined) return null;

  const dayOfWeek = getDayOfWeek(selectedDate);
  const dayName = DAY_NAMES[dayOfWeek];

  // 등락 표시 (asMillion=true이면 백만원 단위로 변환 표시)
  const renderChange = (current, previous, showPct = false, asMillion = false) => {
    if (!previous || previous === 0) return null;
    const rawChange = current - previous;
    const change = Math.sign(rawChange) * Math.floor(Math.abs(rawChange) / 10) * 10;
    if (change === 0) return <span className="text-base-content/50 text-sm">보합</span>;
    const isUp = change > 0;
    const pct = showPct ? ` (${((change / previous) * 100).toFixed(1)}%)` : '';
    const displayVal = asMillion
      ? `${(Math.abs(change) / 1000000).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}백만`
      : Math.abs(change).toLocaleString();
    return (
      <span className={`text-sm font-bold ${isUp ? 'text-red-600' : 'text-blue-600'}`}>
        {isUp ? '▲' : '▼'} {displayVal}{pct}
      </span>
    );
  };

  // 산지/도매 비율
  const seongjuPct = combined.totalBoxes > 0
    ? Math.round((combined.seongjuBoxes / combined.totalBoxes) * 100) : 0;
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
            <span className="text-white font-bold text-lg">산지 + 도매 종합</span>
            <span className="text-white/60 text-sm">({dayName})</span>
          </div>
          <div className="flex gap-1.5">
            {!combined.hasSeonju && (
              <span className="text-sm bg-white/20 text-white px-2.5 py-0.5 rounded-full">
                산지 휴장
              </span>
            )}
            {!combined.hasWholesale && (
              <span className="text-sm bg-white/20 text-white px-2.5 py-0.5 rounded-full">
                도매 휴장
              </span>
            )}
          </div>
        </div>

        {/* 본문 */}
        <div className="px-4 py-4">
          {/* 합산 요약 */}
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-base-content/60 text-base">총 출하량</span>
            <span className="text-2xl font-bold text-base-content">
              {formatPrice(combined.totalBoxes)}
            </span>
            <span className="text-sm text-base-content/50">상자</span>
            {combined.prevBoxes && (
              <span className="ml-1">{renderChange(combined.totalBoxes, combined.prevBoxes)}</span>
            )}
          </div>
          <div className="text-base text-base-content/60 mb-4">
            총 출하금액{' '}
            <span className="font-bold text-base-content text-lg">
              {(combined.totalAmount / 1000000).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
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
              {combined.prevAvg && renderChange(combined.avgPrice, combined.prevAvg)}
            </div>
          </div>

          {/* 산지/도매 비율 바 */}
          {combined.hasSeonju && combined.hasWholesale && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-base-content/60 mb-1">
                <span>산지 {seongjuPct}%</span>
                <span>도매 {wholesalePct}%</span>
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

          {/* 작년 동일 요일 비교 */}
          {lastYearData && (
            <div className="bg-base-200/50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-sm font-bold text-base-content/70">작년 비교</span>
                <span className="text-sm text-base-content/40">
                  ({lastYearData.date} {DAY_NAMES[getDayOfWeek(lastYearData.date)]})
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {/* 평균가 비교 */}
                <div>
                  <div className="text-sm text-base-content/50 mb-1">평균가</div>
                  <div className="text-lg font-bold text-base-content">
                    {formatPrice(lastYearData.avgPrice)}
                  </div>
                  <div className="mt-1">
                    {renderChange(combined.avgPrice, lastYearData.avgPrice, true)}
                  </div>
                </div>
                {/* 출하량 비교 */}
                <div>
                  <div className="text-sm text-base-content/50 mb-1">출하량</div>
                  <div className="text-lg font-bold text-base-content">
                    {formatPrice(lastYearData.totalBoxes)}
                  </div>
                  <div className="mt-1">
                    {renderChange(combined.totalBoxes, lastYearData.totalBoxes, true)}
                  </div>
                </div>
                {/* 출하금액 비교 */}
                <div>
                  <div className="text-sm text-base-content/50 mb-1">출하금액</div>
                  <div className="text-lg font-bold text-base-content">
                    {(lastYearData.totalAmount / 1000000).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
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

          {/* 확장 차트 */}
          {expanded && (
            <div className="mt-2">
              {/* 차트 타입 탭 */}
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

              {trendLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : trendData && trendData.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'price' ? (
                      <ComposedChart data={trendData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
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
                        <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                        {/* 올해 평균가 (실선 + 영역) */}
                        <Area
                          type="monotone"
                          dataKey="avg_price"
                          name="올해"
                          stroke="#059669"
                          strokeWidth={2.5}
                          fill="url(#combinedGradAvg)"
                          dot={{ r: 3, fill: '#059669', strokeWidth: 0 }}
                          activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                        />
                        {/* 작년 평균가 (점선) */}
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
                      <ComposedChart data={trendData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
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
                        <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                        {/* 올해 산지/도매 스택 바 */}
                        <Bar dataKey="seongju_boxes" name="산지" stackId="vol" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="wholesale_boxes" name="도매" stackId="vol" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                        {/* 작년 총 출하량 (점선) */}
                        <Line
                          type="monotone"
                          dataKey="lastYear_total_boxes"
                          name="작년 출하량"
                          stroke="#D97706"
                          strokeWidth={1.5}
                          strokeDasharray="6 3"
                          dot={{ r: 2, fill: '#D97706', strokeWidth: 0 }}
                          connectNulls={false}
                        />
                      </ComposedChart>
                    )}
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-sm text-base-content/40">
                  추세 데이터가 없습니다
                </div>
              )}

              {/* 작년 날짜 매칭 안내 */}
              {trendData?.length > 0 && trendData.some(d => d.lastYear_date) && (
                <div className="text-center mt-1.5 text-xs text-base-content/40">
                  작년 데이터는 동일 요일 기준으로 매칭됩니다
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
