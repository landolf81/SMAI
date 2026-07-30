/* eslint-disable react/prop-types */
/**
 * GradeCategorySummary.jsx
 * 산지 공판장 상세화면 거래 요약 아래 등급 구분별 집계 카드
 * - 시장정보 설정(grade_categories)에서 지정한 특/상/보통 구분으로 그룹화
 * - 구분별 합계수량, 평균가(수량 가중평균), 전일대비, 최고가, 최저가 표시
 * - 구분이 지정된 등급이 하나도 없으면 렌더링하지 않음
 * - Prices.jsx에서 사용
 */
import { useMemo } from 'react';

// 표시 순서: 특 → 상 → 보통
const CATEGORY_ORDER = ['특', '상', '보통'];

// 구분 뱃지 색상
const CATEGORY_BADGE = {
  '특': 'bg-blue-700',
  '상': 'bg-blue-500',
  '보통': 'bg-sky-500',
};

const formatPrice = (price) => {
  return price ? price.toLocaleString('ko-KR') : '0';
};

const GradeCategorySummary = ({ details, categories }) => {
  const rows = useMemo(() => {
    if (!details || details.length === 0 || !categories) return [];

    return CATEGORY_ORDER.map((category) => {
      const items = details.filter((d) => categories[d.grade] === category);
      if (items.length === 0) return null;

      // 합계수량 + 수량 가중 평균가
      const totalBoxes = items.reduce((sum, d) => sum + (d.boxes || 0), 0);
      const totalAmount = items.reduce(
        (sum, d) => sum + (d.boxes || 0) * (d.avg_price || 0), 0
      );
      const avgPrice = totalBoxes > 0 ? Math.round(totalAmount / totalBoxes) : 0;

      // 전일대비: 전일 데이터가 있는 등급들의 가중 평균가 비교
      const prevBoxes = items.reduce(
        (sum, d) => sum + (d.boxes_comparison?.previousBoxes || 0), 0
      );
      const prevAmount = items.reduce(
        (sum, d) =>
          sum +
          (d.boxes_comparison?.previousBoxes || 0) *
            (d.price_comparison?.previousPrice || 0),
        0
      );
      const prevAvgPrice = prevBoxes > 0 ? Math.round(prevAmount / prevBoxes) : 0;
      const change = prevAvgPrice > 0 ? avgPrice - prevAvgPrice : 0;
      const changePercent =
        prevAvgPrice > 0 ? Math.round((change / prevAvgPrice) * 1000) / 10 : 0;

      // 최고가 / 최저가 (0원 제외)
      const maxPrice = Math.max(...items.map((d) => d.max_price || 0));
      const minCandidates = items
        .map((d) => d.min_price || 0)
        .filter((p) => p > 0);
      const minPrice = minCandidates.length > 0 ? Math.min(...minCandidates) : 0;

      return {
        category,
        totalBoxes,
        avgPrice,
        comparisonAvailable: prevAvgPrice > 0,
        change,
        changePercent,
        maxPrice,
        minPrice,
      };
    }).filter(Boolean);
  }, [details, categories]);

  if (rows.length === 0) return null;

  return (
    <div className="bg-base-100 rounded-2xl shadow-md border border-base-200 pt-4 pb-2 px-4 mb-6">
      {/* 타이틀 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-base-content/50">등급별 요약</span>
        <span className="text-sm text-base-content/40">특/상/보통</span>
      </div>

      {/* 헤더 행 */}
      <div className="grid grid-cols-5 gap-1 text-center text-sm text-base-content/50 pb-2 border-b border-base-200">
        <div className="text-left pl-1">구분</div>
        <div>수량</div>
        <div>평균가</div>
        <div>최고가</div>
        <div>최저가</div>
      </div>

      {/* 구분별 행 */}
      <div className="divide-y divide-base-200">
        {rows.map((row) => (
          <div key={row.category} className="grid grid-cols-5 gap-1 text-center items-center py-2.5">
            {/* 구분 뱃지 */}
            <div className="text-left">
              <span
                className={`inline-flex px-2 py-0.5 text-white text-sm font-bold rounded-full ${CATEGORY_BADGE[row.category]}`}
              >
                {row.category}
              </span>
            </div>

            {/* 합계수량 */}
            <div className="text-base font-medium text-base-content whitespace-nowrap">
              {formatPrice(row.totalBoxes)}
            </div>

            {/* 평균가 + 전일대비 */}
            <div>
              <div className="text-base font-bold text-base-content whitespace-nowrap">
                {formatPrice(row.avgPrice)}
              </div>
              <div
                className={`text-xs font-medium whitespace-nowrap ${
                  !row.comparisonAvailable
                    ? 'text-base-content/30'
                    : Math.abs(row.changePercent) < 0.1
                      ? 'text-base-content/40'
                      : row.change > 0
                        ? 'text-red-500'
                        : 'text-blue-500'
                }`}
              >
                {!row.comparisonAvailable
                  ? '-'
                  : Math.abs(row.changePercent) < 0.1
                    ? '보합'
                    : `${row.change > 0 ? '▲' : '▼'} ${Math.abs(row.change).toLocaleString()}`}
              </div>
            </div>

            {/* 최고가 */}
            <div className="text-base font-bold text-red-500 whitespace-nowrap">
              {formatPrice(row.maxPrice)}
            </div>

            {/* 최저가 */}
            <div className="text-base font-bold text-blue-500 whitespace-nowrap">
              {formatPrice(row.minPrice)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GradeCategorySummary;
