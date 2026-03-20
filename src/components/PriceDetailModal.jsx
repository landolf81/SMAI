/**
 * PriceDetailModal.jsx
 * 도매시장 법인별 상세 데이터 모달
 * - 규격 + 출하지명별 평균가, 최고가, 최저가 표시
 * - 각 카드 탭 → 아코디언 펼침 → 등급+크기규격별 세분화 데이터 (T+1)
 * - Prices.jsx에서 도매시장 카드 클릭 시 열림
 */
import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { marketService } from '../services';
import { supabase } from '../config/supabase';

const SETTINGS_KEY = 'detail_grade_display_settings';

// 가격 포맷
const formatPrice = (price) => {
  if (!price && price !== 0) return '-';
  return Number(price).toLocaleString();
};

// 변동값 표시 컴포넌트
const ChangeIndicator = ({ current, prev }) => {
  if (!prev || prev === 0) return null;
  const diff = current - prev;
  if (diff === 0) return <span className="text-xs text-base-content/40">보합</span>;
  const isUp = diff > 0;
  return (
    <span className={`text-xs font-medium ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
      {isUp ? '▲' : '▼'} {formatPrice(Math.abs(diff))}
    </span>
  );
};

// 등급별 세부 데이터 아코디언 내용
const GradeAccordion = ({ marketName, marketDate, shipperName, weight }) => {
  const { data: gradeDetails, isLoading } = useQuery({
    queryKey: ['market-detail-grade', marketName, marketDate, shipperName, weight],
    queryFn: () => marketService.getMarketDetailGrade(marketName, marketDate, shipperName, weight),
    staleTime: 5 * 60 * 1000,
  });

  // 정렬 설정 조회 (캐시 30분)
  const { data: sortSettings } = useQuery({
    queryKey: ['detail-grade-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', SETTINGS_KEY)
        .maybeSingle();
      return data?.value || null;
    },
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!gradeDetails || gradeDetails.length === 0) {
    return (
      <div className="text-center py-4 text-base-content/40 text-sm">
        등급별 세부 데이터가 아직 없습니다 (T+1)
      </div>
    );
  }

  // 등급별로 그룹핑
  const grouped = {};
  gradeDetails.forEach((item) => {
    const key = item.grade || '.';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  // 법인별 저장된 등급 순서 적용
  const corpSettings = sortSettings?.corporations?.[marketName] || {};
  const gradeOrder = corpSettings.grade_order || [];
  const sizeOrder = corpSettings.size_order || [];

  const sortedGradeEntries = Object.entries(grouped).sort(([a], [b]) => {
    const idxA = gradeOrder.indexOf(a);
    const idxB = gradeOrder.indexOf(b);
    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  // 크기규격 정렬 함수
  const sortBySizeOrder = (items) => {
    if (sizeOrder.length === 0) return items;
    return [...items].sort((a, b) => {
      const idxA = sizeOrder.indexOf(a.size_name);
      const idxB = sizeOrder.indexOf(b.size_name);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  };

  return (
    <div className="space-y-2">
      {sortedGradeEntries.map(([grade, items]) => (
        <div key={grade} className="bg-base-100 rounded-lg border border-base-300 overflow-hidden">
          {/* 등급 헤더 */}
          <div className="px-3 py-2 bg-base-200 border-b border-base-300">
            <span className="text-base font-bold text-base-content">
              {grade === '.' ? '미분류' : grade}
            </span>
            <span className="text-sm text-base-content/50 ml-2">
              {items.length}건
            </span>
          </div>
          {/* 크기규격별 데이터 (정렬 적용) */}
          <div className="divide-y divide-base-200">
            {sortBySizeOrder(items).map((item, idx) => (
              <div key={idx} className="px-3 py-2.5">
                {/* 1줄: 크기규격 | 수량 | 변동 */}
                <div className="flex items-baseline gap-3 mb-1.5">
                  <span className="text-base font-bold text-base-content">
                    {item.size_name === '.' ? '미분류' : item.size_name}
                  </span>
                  <span className="text-xs text-base-content/40">수량</span>
                  <span className="text-lg font-bold text-base-content">{formatPrice(item.boxes)}</span>
                  <ChangeIndicator current={item.boxes} prev={item.prev_boxes} />
                </div>
                {/* 2줄: 평균가 | 최고가 | 최저가 */}
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div>
                    <div className="text-base-content/40 text-xs">평균가</div>
                    <div className="text-lg font-bold text-base-content">{formatPrice(item.avg_price)}</div>
                    <ChangeIndicator current={item.avg_price} prev={item.prev_avg_price} />
                  </div>
                  <div>
                    <div className="text-base-content/40 text-xs">최고가</div>
                    <div className="text-lg font-bold text-red-500">{formatPrice(item.max_price)}</div>
                    <ChangeIndicator current={item.max_price} prev={item.prev_max_price} />
                  </div>
                  <div>
                    <div className="text-base-content/40 text-xs">최저가</div>
                    <div className="text-lg font-bold text-blue-500">{formatPrice(item.min_price)}</div>
                    <ChangeIndicator current={item.min_price} prev={item.prev_min_price} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const PriceDetailModal = ({ isOpen, onClose, marketName, marketDate, gradeName }) => {
  const [expandedIndex, setExpandedIndex] = useState(null);

  // 모달 열릴 때 스크롤 잠금 + 아코디언 초기화
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setExpandedIndex(null);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // 상세 데이터 조회
  const { data: details, isLoading } = useQuery({
    queryKey: ['market-detail', marketName, marketDate, gradeName],
    queryFn: () => marketService.getMarketDetail(marketName, marketDate, gradeName),
    enabled: isOpen && !!marketName && !!marketDate && !!gradeName,
    staleTime: 5 * 60 * 1000,
  });

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="px-4 py-3 flex items-center justify-between shrink-0"
          style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #16A34A 100%)' }}
        >
          <div>
            <h2 className="text-lg font-bold text-white">{gradeName}</h2>
            <p className="text-sm text-white/70">{marketDate} 상세</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <CloseIcon className="text-white" />
          </button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !details || details.length === 0 ? (
            /* 데이터 없음 */
            <div className="text-center py-12">
              <InfoOutlinedIcon className="text-base-content/20 mb-3" style={{ fontSize: '3rem' }} />
              <p className="text-base font-medium text-base-content/60">
                상세 데이터가 아직 등록되지 않았습니다.
              </p>
              <p className="text-sm text-base-content/40 mt-2">
                데이터가 등록되면 규격·출하지명별 가격 정보가 표시됩니다.
              </p>
            </div>
          ) : (
            /* 데이터 카드 리스트 (아코디언) */
            <div className="space-y-3">
              {details.map((item, index) => {
                const isExpanded = expandedIndex === index;
                return (
                  <div
                    key={item.id || index}
                    className="bg-base-200/50 rounded-xl border border-base-200 overflow-hidden"
                  >
                    {/* 카드 헤더 (탭 가능) */}
                    <div
                      className="p-3 cursor-pointer active:bg-base-200 transition-colors"
                      onClick={() => setExpandedIndex(isExpanded ? null : index)}
                    >
                      {/* 1줄: 규격 · 출하지명 + 펼침 화살표 */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-lg text-base-content/60">
                          <span className="font-medium text-base-content">{item.weight}</span>
                          <span className="mx-1.5">·</span>
                          <span>{item.shipper_name}</span>
                        </div>
                        <svg
                          className={`w-5 h-5 text-base-content/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      {/* 2줄: 수량 | 평균가 | 최고가 | 최저가 */}
                      <div className="grid grid-cols-4 gap-1 text-center">
                        <div className="bg-base-100 rounded-lg py-2 px-1">
                          <div className="text-sm text-base-content/50 mb-0.5">수량</div>
                          <div className="text-lg font-bold text-base-content whitespace-nowrap">
                            {formatPrice(item.boxes)}
                          </div>
                        </div>
                        <div className="bg-base-100 rounded-lg py-2 px-1">
                          <div className="text-sm text-base-content/50 mb-0.5">평균가</div>
                          <div className="text-lg font-bold text-base-content whitespace-nowrap">
                            {formatPrice(item.avg_price)}
                          </div>
                        </div>
                        <div className="bg-base-100 rounded-lg py-2 px-1">
                          <div className="text-sm text-base-content/50 mb-0.5">최고가</div>
                          <div className="text-lg font-bold text-red-500 whitespace-nowrap">
                            {formatPrice(item.max_price)}
                          </div>
                        </div>
                        <div className="bg-base-100 rounded-lg py-2 px-1">
                          <div className="text-sm text-base-content/50 mb-0.5">최저가</div>
                          <div className="text-lg font-bold text-blue-500 whitespace-nowrap">
                            {formatPrice(item.min_price)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 아코디언 펼침: 등급별 세부 데이터 */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-base-300">
                        <div className="text-xs font-medium text-base-content/50 mb-2">
                          📊 등급·크기규격별 세부
                        </div>
                        <GradeAccordion
                          marketName={gradeName}
                          marketDate={marketDate}
                          shipperName={item.shipper_name}
                          weight={item.weight}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 하단 닫기 버튼 */}
        <div className="px-4 py-3 border-t border-base-300 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg font-medium transition-colors border border-base-300 text-base-content hover:bg-base-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PriceDetailModal;
