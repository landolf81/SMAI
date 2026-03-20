/**
 * LocalMarketDetailModal.jsx
 * 산지(로컬마켓) 등급별 원본 데이터 모달
 * - 카드 클릭 시 해당 등급의 산지, 수량, 경락가 표시
 * - market_data_raw 테이블에서 데이터 조회
 * - Prices.jsx에서 LOCAL_MARKETS 카드 클릭 시 열림
 */
import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { marketService } from '../services';

const formatPrice = (price) => {
  if (!price && price !== 0) return '-';
  return Number(price).toLocaleString();
};

const LocalMarketDetailModal = ({ isOpen, onClose, marketName, marketDate, gradeName }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['market-data-raw', marketName, marketDate, gradeName],
    queryFn: () => marketService.getMarketDataRaw(marketName, marketDate, gradeName),
    enabled: isOpen && !!marketName && !!marketDate && !!gradeName,
    staleTime: 5 * 60 * 1000,
  });

  const showGradeCol = marketName === '대전공판장';

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
            <h2 className="text-2xl font-bold text-white">{gradeName}</h2>
            <p className="text-base text-white/70">{marketName} · {marketDate}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <CloseIcon className="text-white" />
          </button>
        </div>

        {/* 본문 (산지별 요약 + 개별 거래 내역 통합 스크롤) */}
        <div className="overflow-y-auto flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !rawData || rawData.length === 0 ? (
            <div className="text-center py-12">
              <InfoOutlinedIcon className="text-base-content/20 mb-3" style={{ fontSize: '3rem' }} />
              <p className="text-base font-medium text-base-content/60">
                상세 데이터가 아직 등록되지 않았습니다.
              </p>
            </div>
          ) : (
            <>
              {/* 개별 거래 내역 */}
              <div>
                <div className="text-base font-medium text-base-content/50 mb-2">
                  개별 거래 내역 ({rawData.length}건)
                </div>
                <div className="bg-base-200/30 rounded-xl border border-base-200 overflow-hidden">
                  <div className={`grid ${showGradeCol ? 'grid-cols-4' : 'grid-cols-3'} gap-0 text-center text-sm font-medium text-base-content/50 bg-base-200 py-2.5 px-4`}>
                    <div className="text-left">산지</div>
                    {showGradeCol && <div>과수</div>}
                    <div>수량</div>
                    <div>경락가</div>
                  </div>
                  <div className="divide-y divide-base-200">
                    {rawData.map((item, idx) => (
                      <div key={idx} className={`grid ${showGradeCol ? 'grid-cols-4' : 'grid-cols-3'} gap-0 text-center py-2.5 px-4`}>
                        <div className="text-left text-base text-base-content truncate">{item.origin}</div>
                        {showGradeCol && <div className="text-base text-base-content">{item.grade}</div>}
                        <div className="text-base font-medium text-base-content">{formatPrice(item.boxes)}</div>
                        <div className="text-base font-bold text-base-content">{formatPrice(item.price)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
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

export default LocalMarketDetailModal;
