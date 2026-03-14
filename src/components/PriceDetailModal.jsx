/**
 * PriceDetailModal.jsx
 * 도매시장 법인별 상세 데이터 모달
 * - 규격 + 출하지명별 평균가, 최고가, 최저가 표시
 * - Prices.jsx에서 도매시장 카드 클릭 시 열림
 */
import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { marketService } from '../services';

// 가격 포맷
const formatPrice = (price) => {
  if (!price && price !== 0) return '-';
  return Number(price).toLocaleString();
};

const PriceDetailModal = ({ isOpen, onClose, marketName, marketDate, gradeName }) => {
  // 모달 열릴 때 스크롤 잠금
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
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
            /* 데이터 카드 리스트 */
            <div className="space-y-3">
              {details.map((item, index) => (
                <div
                  key={item.id || index}
                  className="bg-base-200/50 rounded-xl p-3 border border-base-200"
                >
                  {/* 1줄: 규격 · 출하지명 */}
                  <div className="text-lg text-base-content/60 mb-2">
                    <span className="font-medium text-base-content">{item.weight}</span>
                    <span className="mx-1.5">·</span>
                    <span>{item.shipper_name}</span>
                  </div>
                  {/* 2줄: 평균가 | 최고가 | 최저가 */}
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="bg-base-100 rounded-lg py-2 px-1">
                      <div className="text-sm text-base-content/50 mb-0.5">평균가</div>
                      <div className="text-base font-bold text-base-content whitespace-nowrap">
                        {formatPrice(item.avg_price)}
                      </div>
                    </div>
                    <div className="bg-base-100 rounded-lg py-2 px-1">
                      <div className="text-sm text-base-content/50 mb-0.5">최고가</div>
                      <div className="text-base font-bold text-red-500 whitespace-nowrap">
                        {formatPrice(item.max_price)}
                      </div>
                    </div>
                    <div className="bg-base-100 rounded-lg py-2 px-1">
                      <div className="text-sm text-base-content/50 mb-0.5">최저가</div>
                      <div className="text-base font-bold text-blue-500 whitespace-nowrap">
                        {formatPrice(item.min_price)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
