/**
 * MarketSearchModal.jsx
 * 도매시장 법인명(등급) 검색 모달
 * - 플로팅 검색 버튼 클릭 시 열림
 * - 제외 시장 8곳 제외한 전체 도매시장 등급 카드 표시
 * - 법인명 검색 필터링
 * - 카드 클릭 시 상세 모달 (가격+변동+detail)
 */
import { createPortal } from 'react-dom';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { marketService } from '../services';

// 검색 제외 시장 목록
const EXCLUDED_MARKETS = [
  '선남농협', '성주원예', '성주조공', '용암농협', '초전농협',
  '가락공판장', '대전공판장', '광주공판장', '구리공판장',
  '목포원예농업협동조합', '경주농협 공판장', '제주시농협농산물공판장'
];

// 가격 포맷
const formatPrice = (price) => {
  if (!price && price !== 0) return '-';
  return Number(price).toLocaleString();
};

// 변동폭 표시 헬퍼
const renderChange = (current, previous) => {
  if (!previous || previous <= 0) return <span className="text-base-content/30">-</span>;
  const change = current - previous;
  const percent = Math.round((change / previous) * 1000) / 10;
  if (Math.abs(percent) < 0.1) return <span className="text-base-content/40">보합</span>;
  const isUp = change > 0;
  return (
    <span className={isUp ? 'text-red-500' : 'text-blue-500'}>
      {isUp ? '▲' : '▼'} {Math.abs(change).toLocaleString()}
    </span>
  );
};

// ─── 검색 결과 목록 뷰 ───
const SearchListView = ({ filteredGrades, allGrades, searchTerm, isLoading, onSelect }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (filteredGrades.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-base font-medium text-base-content/60">
          {searchTerm ? `"${searchTerm}" 검색 결과가 없습니다` : '데이터가 없습니다'}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {filteredGrades.map((item, index) => (
        <div
          key={`${item.market_name}-${item.grade}-${item.weight}-${index}`}
          className="bg-base-200/50 rounded-xl p-3 border border-base-200 cursor-pointer active:scale-[0.98] transition-transform"
          onClick={() => onSelect(item)}
        >
          {/* 1줄: 시장명 뱃지 + 법인명 */}
          <div className="text-lg text-base-content/60 mb-2 flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold text-white rounded-full bg-blue-600 shrink-0">
              {item.market_name}
            </span>
            <span className="font-medium text-base-content">{item.grade}</span>
            <span className="text-sm text-base-content/40">{item.weight}</span>
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
      ))}
    </div>
  );
};

// ─── 카드 상세 뷰 (가격+변동+detail) ───
const DetailView = ({ item, marketDate }) => {
  // 경량 비교 데이터 조회 (2 쿼리 병렬)
  const { data: gradeComparison } = useQuery({
    queryKey: ['grade-comparison', item.market_name, marketDate, item.grade, item.weight],
    queryFn: () => marketService.getGradeComparison(item.market_name, marketDate, item.grade, item.weight),
    staleTime: 5 * 60 * 1000,
  });

  // 해당 법인의 detail 데이터 조회
  const { data: details, isLoading: detailLoading } = useQuery({
    queryKey: ['market-detail', item.market_name, marketDate, item.grade],
    queryFn: () => marketService.getMarketDetail(item.market_name, marketDate, item.grade),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-4">
      {/* 가격 카드 */}
      <div className="bg-base-200/50 rounded-xl p-4 border border-base-200">
        <div className="text-lg mb-3 flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold text-white rounded-full bg-blue-600 shrink-0">
            {item.market_name}
          </span>
          <span className="font-bold text-base-content">{item.grade}</span>
          <span className="text-sm text-base-content/40">{item.weight}</span>
        </div>

        {/* 수량 | 평균가 | 최고가 | 최저가 + 각 변동폭 */}
        <div className="grid grid-cols-4 gap-1 text-center">
          <div className="bg-base-100 rounded-lg py-2 px-1">
            <div className="text-sm text-base-content/50 mb-0.5">수량</div>
            <div className="text-lg font-bold text-base-content whitespace-nowrap">
              {formatPrice(item.boxes)}
            </div>
            <div className="text-sm font-medium mt-1">
              {gradeComparison?.boxes_comparison?.comparison_available
                ? renderChange(item.boxes, gradeComparison.boxes_comparison.previousBoxes)
                : <span className="text-base-content/30">-</span>
              }
            </div>
          </div>
          <div className="bg-base-100 rounded-lg py-2 px-1">
            <div className="text-sm text-base-content/50 mb-0.5">평균가</div>
            <div className="text-lg font-bold text-base-content whitespace-nowrap">
              {formatPrice(item.avg_price)}
            </div>
            <div className="text-sm font-medium mt-1">
              {gradeComparison?.price_comparison?.comparison_available
                ? renderChange(item.avg_price, gradeComparison.price_comparison.previousPrice)
                : <span className="text-base-content/30">-</span>
              }
            </div>
          </div>
          <div className="bg-base-100 rounded-lg py-2 px-1">
            <div className="text-sm text-base-content/50 mb-0.5">최고가</div>
            <div className="text-lg font-bold text-red-500 whitespace-nowrap">
              {formatPrice(item.max_price)}
            </div>
            <div className="text-sm font-medium mt-1">
              {gradeComparison?.max_price_comparison?.comparison_available
                ? renderChange(
                    item.max_price,
                    item.max_price - gradeComparison.max_price_comparison.change
                  )
                : <span className="text-base-content/30">-</span>
              }
            </div>
          </div>
          <div className="bg-base-100 rounded-lg py-2 px-1">
            <div className="text-sm text-base-content/50 mb-0.5">최저가</div>
            <div className="text-lg font-bold text-blue-500 whitespace-nowrap">
              {formatPrice(item.min_price)}
            </div>
            <div className="text-sm font-medium mt-1">
              {gradeComparison?.min_price_comparison?.comparison_available
                ? renderChange(
                    item.min_price,
                    item.min_price - gradeComparison.min_price_comparison.change
                  )
                : <span className="text-base-content/30">-</span>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Detail 정보 (규격+출하지명별) */}
      <div>
        <h3 className="text-base font-bold text-base-content mb-2 px-1">출하지 상세</h3>
        {detailLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !details || details.length === 0 ? (
          <div className="text-center py-8">
            <InfoOutlinedIcon className="text-base-content/20 mb-2" style={{ fontSize: '2.5rem' }} />
            <p className="text-sm text-base-content/50">상세 데이터가 아직 등록되지 않았습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {details.map((d, i) => (
              <div key={d.id || i} className="bg-base-200/50 rounded-xl p-3 border border-base-200">
                <div className="text-base text-base-content/60 mb-2">
                  <span className="font-medium text-base-content">{d.weight}</span>
                  <span className="mx-1.5">·</span>
                  <span>{d.shipper_name}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-center">
                  <div className="bg-base-100 rounded-lg py-1.5 px-1">
                    <div className="text-xs text-base-content/50 mb-0.5">수량</div>
                    <div className="text-base font-bold text-base-content whitespace-nowrap">
                      {formatPrice(d.boxes)}
                    </div>
                  </div>
                  <div className="bg-base-100 rounded-lg py-1.5 px-1">
                    <div className="text-xs text-base-content/50 mb-0.5">평균가</div>
                    <div className="text-base font-bold text-base-content whitespace-nowrap">
                      {formatPrice(d.avg_price)}
                    </div>
                  </div>
                  <div className="bg-base-100 rounded-lg py-1.5 px-1">
                    <div className="text-xs text-base-content/50 mb-0.5">최고가</div>
                    <div className="text-base font-bold text-red-500 whitespace-nowrap">
                      {formatPrice(d.max_price)}
                    </div>
                  </div>
                  <div className="bg-base-100 rounded-lg py-1.5 px-1">
                    <div className="text-xs text-base-content/50 mb-0.5">최저가</div>
                    <div className="text-base font-bold text-blue-500 whitespace-nowrap">
                      {formatPrice(d.min_price)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 메인 모달 컴포넌트 ───
const MarketSearchModal = ({ isOpen, onClose, marketDate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const inputRef = useRef(null);

  // 모달 열릴 때 스크롤 잠금 + 포커스
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = 'unset';
      setSearchTerm('');
      setSelectedItem(null);
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // 도매시장 등급 데이터 조회
  const { data: allGrades, isLoading } = useQuery({
    queryKey: ['market-search-grades', marketDate],
    queryFn: () => marketService.searchMarketGrades(marketDate, EXCLUDED_MARKETS),
    enabled: isOpen && !!marketDate,
    staleTime: 5 * 60 * 1000,
  });

  // 검색어로 필터링
  const filteredGrades = useMemo(() => {
    if (!allGrades) return [];
    if (!searchTerm.trim()) return allGrades;
    const term = searchTerm.trim().toLowerCase().normalize('NFC');
    return allGrades.filter(item =>
      item.grade?.toLowerCase().normalize('NFC').includes(term) ||
      item.market_name?.toLowerCase().normalize('NFC').includes(term)
    );
  }, [allGrades, searchTerm]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-[9999] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md h-[85vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-4 py-3 flex items-center justify-between shrink-0 border-b border-base-200">
          <div className="flex items-center gap-2">
            {selectedItem && (
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-full hover:bg-base-200 transition-colors"
              >
                <ArrowBackIcon className="text-base-content" style={{ fontSize: 20 }} />
              </button>
            )}
            <h2 className="text-lg font-bold text-base-content">
              {selectedItem ? `${selectedItem.grade}` : '도매시장 법인 검색'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-base-200 transition-colors"
          >
            <CloseIcon className="text-base-content/60" />
          </button>
        </div>

        {/* 검색바 (목록 뷰에서만) */}
        {!selectedItem && (
          <div className="px-4 py-3 shrink-0 border-b border-base-200">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                placeholder="시장명 또는 법인명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-base-300 bg-base-200 text-base-content placeholder:text-base-content/40 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-base"
              />
              {searchTerm && (
                <button
                  onClick={() => { setSearchTerm(''); inputRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-base-content/40 hover:text-base-content transition-colors"
                >
                  <CloseIcon style={{ fontSize: 18 }} />
                </button>
              )}
            </div>
            {allGrades && (
              <div className="mt-1.5 text-sm text-base-content/50 px-1">
                {searchTerm
                  ? `검색 결과: ${filteredGrades.length}건 / 전체 ${allGrades.length}건`
                  : `전체 ${allGrades.length}건`
                }
              </div>
            )}
          </div>
        )}

        {/* 본문 */}
        <div className="overflow-y-auto flex-1 p-4">
          {selectedItem ? (
            <DetailView item={selectedItem} marketDate={marketDate} />
          ) : (
            <SearchListView
              filteredGrades={filteredGrades}
              allGrades={allGrades}
              searchTerm={searchTerm}
              isLoading={isLoading}
              onSelect={setSelectedItem}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MarketSearchModal;
