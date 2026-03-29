/**
 * CombinedMarketCard.jsx
 * 홈 화면 최하단 - 산지 + 도매 종합 카드
 *
 * 표시 규칙:
 * - baseDate = 항상 selectedDate - 1 (전일)
 * - 합산 = 산지(baseDate=전일) + 도매(selectedDate=당일)
 * - 예: 선택일 26일 → 산지 25일 + 도매 26일
 * - 전년 비교·차트: 항상 전일 기준, 산지+도매 합산
 * - 좌우 스크롤 차트 + 미래 날짜는 전년만
 */
import React, { useState, useMemo } from 'react';
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
// ExpandMore/Less 아이콘 제거 — 차트 항상 표시
import { marketCombinedService } from '../services';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const getDayOfWeek = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

const formatShortDate = (dateStr) => dateStr ? dateStr.slice(5).replace('-', '/') : '';

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

// 산지 경매 가능일(직전 거래일) 찾기
// 토요일(6)은 산지 휴장 → 건너뛰어서 금요일로
const getPrevTradingDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1); // 전일로 이동
  // 토요일(6)이면 금요일(5)로 한 칸 더
  if (dt.getDay() === 6) {
    dt.setDate(dt.getDate() - 1);
  }
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
  const [chartType, setChartType] = useState('price');
  const [activeChartData, setActiveChartData] = useState(null);

  // 차트 내 툴팁 숨기고 아래 패널에 표시
  const EmptyTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      const d = payload[0]?.payload;
      if (d && d !== activeChartData) {
        setTimeout(() => setActiveChartData(d), 0);
      }
    }
    return <div style={{ display: 'none' }} />;
  };

  // 기준일: selectedDate의 직전 산지 거래일 (토요일 휴장 건너뜀)
  // 예: 26일(수) → baseDate=25일(화) 산지 + 26일(수) 도매
  //     일요일   → baseDate=금요일 산지 + 토요일 도매 (토 산지 휴장)
  const baseDate = getPrevTradingDate(selectedDate);
  const wholesaleDate = getNextDate(baseDate); // 도매 = baseDate + 1

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

  // 추세 차트 날짜 범위: baseDate 기준 과거 10일 + 미래 5일
  const dateRange = useMemo(() => {
    const [y, m, d] = baseDate.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    const end = new Date(base);
    end.setDate(end.getDate() + 5); // 미래 5일 (작년 데이터만)
    const start = new Date(base);
    start.setDate(start.getDate() - 10); // 과거 10일
    const f = (dt) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    return { start: f(start), end: f(end) };
  }, [baseDate]);

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['combinedTrend', dateRange.start, dateRange.end],
    queryFn: () => marketCombinedService.getCombinedTrendData(dateRange.start, dateRange.end),
    staleTime: 5 * 60 * 1000,
  });

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
  const renderChange = (current, previous, _unused = false, asMillion = false) => {
    if (!previous || previous === 0) return null;
    const rawChange = current - previous;
    const change = Math.sign(rawChange) * Math.floor(Math.abs(rawChange) / 10) * 10;
    if (change === 0) return <span className="text-base-content/50 text-sm">보합</span>;
    const isUp = change > 0;
    const displayVal = asMillion
      ? `${(Math.abs(change) / 1000000).toLocaleString('ko-KR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}백만`
      : Math.abs(change).toLocaleString();
    return (
      <span className={`text-sm font-bold ${isUp ? 'text-red-600' : 'text-blue-600'}`}>
        {isUp ? '▲' : '▼'} {displayVal}
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
            <span className="text-yellow-300 font-bold text-base">({dayName})</span>
          </div>
        </div>

        {/* 본문 */}
        <div className="px-4 py-4">
          {/* 날짜 안내 — 항상 전일 기준 */}
          <div className="text-base font-semibold text-warning mb-2">
            산지 {formatShortDate(baseDate)}({DAY_NAMES[getDayOfWeek(baseDate)]}) + 도매 {formatShortDate(wholesaleDate)}({DAY_NAMES[getDayOfWeek(wholesaleDate)]})
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

          {/* 추세 차트 — 항상 표시 */}
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

              {trendLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : trendData && trendData.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'price' ? (
                      <ComposedChart
                        data={trendData}
                        margin={{ top: 5, right: 5, left: -15, bottom: 0 }}
                        onMouseMove={(s) => s?.activePayload?.length && setActiveChartData(s.activePayload[0].payload)}
                        onMouseLeave={() => setActiveChartData(null)}
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
                        <Tooltip content={<EmptyTooltip />} cursor={{ stroke: '#059669', strokeWidth: 1, strokeDasharray: '4 4' }} />
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
                        data={trendData}
                        margin={{ top: 5, right: 5, left: -15, bottom: 0 }}
                        onMouseMove={(s) => s?.activePayload?.length && setActiveChartData(s.activePayload[0].payload)}
                        onMouseLeave={() => setActiveChartData(null)}
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
                        <Tooltip content={<EmptyTooltip />} cursor={{ stroke: '#059669', strokeWidth: 1, strokeDasharray: '4 4' }} />
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
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-sm text-base-content/40">
                  추세 데이터가 없습니다
                </div>
              )}

              {/* 차트 아래 고정 정보 패널 */}
              {activeChartData && (
                <div className="mt-2 p-3 bg-base-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-base font-bold text-base-content">
                      {activeChartData.market_date} ({DAY_NAMES[getDayOfWeek(activeChartData.market_date)]})
                    </span>
                    {activeChartData.lastYear_date && (
                      <span className="text-xs text-base-content/40">작년 {activeChartData.lastYear_date}</span>
                    )}
                  </div>
                  {chartType === 'price' ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-center flex-1">
                        <p className="text-xs text-base-content/50 mb-0.5">평균가</p>
                        <p className="text-xl font-bold text-emerald-600">{(activeChartData.avg_price || 0).toLocaleString()}</p>
                      </div>
                      {activeChartData.lastYear_avg_price != null && (
                        <div className="text-center flex-1">
                          <p className="text-xs text-base-content/50 mb-0.5">전년</p>
                          <p className="text-xl font-bold text-base-content/40">{activeChartData.lastYear_avg_price.toLocaleString()}</p>
                        </div>
                      )}
                      {activeChartData.avg_price > 0 && activeChartData.lastYear_avg_price > 0 && (() => {
                        const diff = activeChartData.avg_price - activeChartData.lastYear_avg_price;
                        const isUp = diff > 0;
                        return (
                          <div className="text-center flex-1">
                            <p className="text-xs text-base-content/50 mb-0.5">변동</p>
                            <p className={`text-xl font-bold ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
                              {isUp ? '▲' : '▼'}{Math.abs(diff).toLocaleString()}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div>
                        <p className="text-xs text-base-content/50 mb-0.5">올해 합계</p>
                        <p className="text-2xl font-bold text-base-content">
                          {((activeChartData.seongju_boxes || 0) + (activeChartData.wholesale_boxes || 0)).toLocaleString()}
                        </p>
                        <div className="flex justify-center gap-3 mt-1 text-sm font-bold">
                          <span className="text-blue-600">{(activeChartData.seongju_boxes || 0).toLocaleString()}</span>
                          <span className="text-purple-600">{(activeChartData.wholesale_boxes || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-base-content/50 mb-0.5">작년 합계</p>
                        <p className="text-xl text-base-content/40">{(activeChartData.lastYear_total_boxes || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {trendData?.length > 0 && !activeChartData && trendData.some(d => d.lastYear_date) && (
                <div className="text-center mt-1.5 text-xs text-base-content/40">
                  차트를 터치하면 상세 정보를 볼 수 있습니다
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default CombinedMarketCard;
