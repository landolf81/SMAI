/**
 * FavoritePrices.jsx
 * 즐겨찾기 시세 페이지 - 즐겨찾기한 공판장/등급의 특정 날짜 시세 표시
 * 날짜 네비게이션으로 과거/현재 시세 탐색 가능
 */
import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { marketService } from '../services';
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

// 가격 포맷
const formatPrice = (price) => {
  if (!price && price !== 0) return '-';
  return Number(price).toLocaleString();
};

// 날짜 포맷 (헤더용)
const formatDateHeader = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
};

// 뱃지 색상
const getMarketBadgeColor = () => '#1D4ED8';

// 변동폭 렌더링 헬퍼
const ChangeText = ({ comparison }) => {
  if (!comparison?.comparison_available) return <span className="text-base-content/30">-</span>;
  if (Math.abs(comparison.changePercent) < 0.1) return <span className="text-base-content/40">보합</span>;
  const isUp = comparison.change > 0;
  return (
    <span className={isUp ? 'text-red-500' : 'text-blue-500'}>
      {isUp ? '▲' : '▼'} {Math.abs(comparison.change).toLocaleString()}
    </span>
  );
};

// 날짜 +-1일
const shiftDate = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const FavoritePrices = () => {
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [favPrices, setFavPrices] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const dateInputRef = useRef(null);

  // 즐겨찾기 목록 로드 (최초 1회)
  useEffect(() => {
    if (!currentUser) return;
    marketService.getFavorites().then(setFavorites).catch(() => {});
  }, [currentUser]);

  // 날짜 변경 시 시세 로드
  const loadPrices = useCallback(async () => {
    if (favorites.length === 0) {
      setFavPrices([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const prices = await marketService.getFavoritePrices(favorites, selectedDate);
      setFavPrices(prices);
    } catch {
      toast.error('시세를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [favorites, selectedDate]);

  useEffect(() => {
    if (favorites.length > 0) loadPrices();
    else if (currentUser) setLoading(false);
  }, [favorites, loadPrices, currentUser]);

  // 날짜 이동
  const handlePrevDate = () => setSelectedDate(prev => shiftDate(prev, -1));
  const handleNextDate = () => {
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate < today) setSelectedDate(prev => shiftDate(prev, 1));
  };

  // 즐겨찾기 해제
  const handleRemove = async (favId) => {
    try {
      await marketService.removeFromFavorites(favId);
      setFavorites(prev => prev.filter(f => f.id !== favId));
      setFavPrices(prev => prev.filter(fp => fp.favorite.id !== favId));
      toast('즐겨찾기가 해제되었습니다', { icon: '☆' });
    } catch {
      toast.error('처리 중 오류가 발생했습니다');
    }
  };

  // 카드 순서 변경 + DB 저장
  const saveOrder = useCallback(async (newPrices) => {
    try {
      const orderUpdates = newPrices.map((fp, i) => ({
        id: fp.favorite.id,
        sort_order: i,
      }));
      await marketService.updateFavoriteOrder(orderUpdates);
    } catch {
      // 순서 저장 실패해도 UI는 유지
    }
  }, []);

  const handleMoveUp = (index) => {
    if (index === 0) return;
    setFavPrices(prev => {
      const arr = [...prev];
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      saveOrder(arr);
      return arr;
    });
  };

  const handleMoveDown = (index) => {
    setFavPrices(prev => {
      if (index >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
      saveOrder(arr);
      return arr;
    });
  };

  // 카드 클릭 → Prices 페이지
  const handleCardClick = (marketName) => {
    navigate(`/prices?market=${encodeURIComponent(marketName)}&date=${selectedDate}`);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-base-200 pt-16 pb-24">
      {/* 헤더 */}
      <div className="bg-base-100 border-b border-base-300 sticky top-14 z-10">
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-base-300 rounded-full transition-colors active:scale-90"
            title="뒤로가기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>
          <h1 className="ml-2 text-lg font-bold text-base-content">즐겨찾기 시세</h1>
        </div>
      </div>

      {/* 날짜 네비게이션 */}
      <div className="bg-base-200 shadow-sm border-b sticky top-[105px] z-10">
        <div className="flex items-center justify-center gap-1 py-3 px-4">
          <button
            onClick={handlePrevDate}
            className="p-2 hover:bg-base-300 rounded-full transition-colors active:scale-90"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => dateInputRef.current?.showPicker?.()}
            className="px-4 py-1.5 text-lg font-bold text-base-content hover:bg-base-300 rounded-lg transition-colors relative"
          >
            {selectedDate}
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            tabIndex={-1}
          />

          <button
            onClick={handleNextDate}
            disabled={selectedDate >= today}
            className={`p-2 rounded-full transition-colors active:scale-90 ${
              selectedDate >= today ? 'text-base-content/20' : 'hover:bg-base-300'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="w-full max-w-screen-xl mx-auto p-4">
        {loading ? (
          <LoadingSpinner />
        ) : favorites.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-16 h-16 mx-auto mb-4 text-base-content/20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <p className="text-base-content/50 text-lg">즐겨찾기한 시세가 없습니다</p>
            <p className="text-base-content/30 text-sm mt-2">시세 화면에서 ★ 버튼을 눌러 추가해보세요</p>
          </div>
        ) : (
          <div className="space-y-6">
            {favPrices.map((fp, idx) => {
              const { favorite: fav, type, data } = fp;

              // 공통 순서/삭제 버튼
              const ActionButtons = ({ stopProp }) => (
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { if (stopProp) e.stopPropagation(); handleMoveUp(idx); }}
                    disabled={idx === 0}
                    className={`p-1.5 rounded-full shadow-sm bg-base-100 border border-base-300 transition-transform active:scale-90 ${idx === 0 ? 'opacity-30' : ''}`}
                    title="위로"
                  >
                    <svg className="w-4 h-4 text-base-content" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { if (stopProp) e.stopPropagation(); handleMoveDown(idx); }}
                    disabled={idx === favPrices.length - 1}
                    className={`p-1.5 rounded-full shadow-sm bg-base-100 border border-base-300 transition-transform active:scale-90 ${idx === favPrices.length - 1 ? 'opacity-30' : ''}`}
                    title="아래로"
                  >
                    <svg className="w-4 h-4 text-base-content" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { if (stopProp) e.stopPropagation(); handleRemove(fav.id); }}
                    className="p-1.5 rounded-full shadow-sm bg-base-100 border border-base-300 transition-transform active:scale-90"
                    title="즐겨찾기 해제"
                  >
                    <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );

              // 해당 날짜에 경매 데이터 없음
              if (!data) {
                return (
                  <div key={fav.id} className="relative pt-4">
                    <div className="absolute -top-0 left-4 right-4 z-10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-base font-bold rounded-full shadow-md"
                          style={{ backgroundColor: getMarketBadgeColor() }}
                        >
                          <span className="w-2 h-2 bg-white rounded-full"></span>
                          {fav.market_name}
                        </span>
                        {fav.grade !== 'summary' && (
                          <span
                            className="inline-flex items-center px-2.5 py-1.5 text-white text-sm font-bold rounded-full shadow-md"
                            style={{ backgroundColor: getMarketBadgeColor() }}
                          >
                            {fav.grade}
                          </span>
                        )}
                      </div>
                      <ActionButtons />
                    </div>
                    <div className="bg-base-100 rounded-2xl shadow-md border border-base-200 pt-6 pb-4 px-4">
                      <p className="text-base-content/40 text-center py-4">
                        {formatDateHeader(selectedDate)} 경매 데이터 없음
                      </p>
                    </div>
                  </div>
                );
              }

              // Summary 카드 (홈 카드 스타일)
              if (type === 'summary') {
                return (
                  <div key={fav.id} className="relative pt-4">
                    {/* 공판장명 뱃지 + 순서/삭제 버튼 */}
                    <div className="absolute -top-0 left-4 right-4 z-10 flex items-center justify-between">
                      <span
                        className="inline-flex items-center gap-2 px-4 py-2 text-white text-base font-bold rounded-full shadow-md"
                        style={{ backgroundColor: getMarketBadgeColor() }}
                      >
                        <span className="w-2.5 h-2.5 bg-white rounded-full"></span>
                        {fav.market_name}
                      </span>
                      <ActionButtons stopProp />
                    </div>

                    {/* 카드 본체 */}
                    <div
                      className="rounded-2xl overflow-hidden shadow-md border border-base-200 bg-base-100 cursor-pointer active:scale-[0.98] transition-transform"
                      onClick={() => handleCardClick(fav.market_name)}
                    >
                      <div className="px-4 py-2 pt-6">
                        {/* 총 출하량 */}
                        <div className="flex items-center text-base text-base-content/60 mb-2">
                          <span>총 출하량</span>
                          <span className="font-bold text-base-content text-lg ml-1">{formatPrice(data.total_boxes)}</span>
                          <span className="text-sm text-base-content/50 ml-1">상자</span>
                          {data.boxes_comparison?.comparison_available && data.boxes_comparison.change !== 0 && (
                            <span className={`ml-2 text-sm font-medium ${data.boxes_comparison.change > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                              {data.boxes_comparison.change > 0 ? '▲' : '▼'} {Math.abs(data.boxes_comparison.change).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {/* 총 출하금액 */}
                        <div className="text-base text-base-content/60 mb-4">
                          총 출하금액 <span className="font-bold text-base-content">{formatPrice(data.total_amount)}</span> <span className="text-base-content/60">원</span>
                        </div>

                        {/* 가격 3열 그리드 */}
                        <div className="grid grid-cols-3 gap-1 text-center">
                          {/* 전체 평균가 */}
                          <div className="bg-base-100 rounded-lg py-2 px-0.5 shadow-sm">
                            <div className="text-xs text-base-content/50 mb-0.5">전체 평균가</div>
                            <div className="text-xl font-bold text-base-content">
                              {formatPrice(data.overall_avg_price)}
                            </div>
                            <div className="mt-0.5 min-h-[20px] text-sm font-medium">
                              <ChangeText comparison={data.overall_comparison} />
                            </div>
                          </div>
                          {/* 전체 최고가 */}
                          <div className="bg-base-100 rounded-lg py-2 px-0.5 shadow-sm">
                            <div className="text-xs text-base-content/50 mb-0.5">전체 최고가</div>
                            <div className="text-xl font-bold text-red-600">
                              {formatPrice(data.max_price)}
                            </div>
                            <div className="mt-0.5 min-h-[20px] text-sm font-medium">
                              <ChangeText comparison={data.max_comparison} />
                            </div>
                          </div>
                          {/* 전체 최저가 */}
                          <div className="bg-base-100 rounded-lg py-2 px-0.5 shadow-sm">
                            <div className="text-xs text-base-content/50 mb-0.5">전체 최저가</div>
                            <div className="text-xl font-bold text-blue-600">
                              {formatPrice(data.min_price)}
                            </div>
                            <div className="mt-0.5 min-h-[20px] text-sm font-medium">
                              <ChangeText comparison={data.min_comparison} />
                            </div>
                          </div>
                        </div>

                        {/* 상세 가격 보기 버튼 */}
                        <div className="mt-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCardClick(fav.market_name); }}
                            className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold py-3 px-4 rounded-lg hover:opacity-90 transition-all shadow-md"
                          >
                            상세 가격 보기
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Data (등급별) 카드
              return (
                <div
                  key={fav.id}
                  className="relative pt-4 cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => handleCardClick(fav.market_name)}
                >
                  <div className="absolute -top-0 left-4 right-4 z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-base font-bold rounded-full shadow-md"
                        style={{ backgroundColor: getMarketBadgeColor() }}
                      >
                        <span className="w-2 h-2 bg-white rounded-full"></span>
                        {fav.market_name}
                      </span>
                      <span
                        className="inline-flex items-center px-2.5 py-1.5 text-white text-sm font-bold rounded-full shadow-md"
                        style={{ backgroundColor: getMarketBadgeColor() }}
                      >
                        {data.grade}
                      </span>
                    </div>
                    <ActionButtons stopProp />
                  </div>

                  <div className="bg-base-100 rounded-2xl shadow-md border border-base-200 pt-6 pb-4 px-4">
                    <div className="text-base text-base-content/60 mb-3 flex items-center gap-2">
                      <span>참외 {data.weight} · 수량 <span className="font-semibold text-base-content">{formatPrice(data.boxes)}상자</span></span>
                      {data.boxes_comparison?.comparison_available && data.boxes_comparison.change !== 0 && (
                        <span className={`text-base font-medium ${data.boxes_comparison.change > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                          ({data.boxes_comparison.change > 0 ? '+' : ''}{formatPrice(data.boxes_comparison.change)})
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="bg-base-200 rounded-lg py-3 px-1">
                        <div className="text-sm text-base-content/50 mb-1">평균가</div>
                        <div className="text-lg font-bold text-base-content whitespace-nowrap">
                          {formatPrice(data.avg_price)}
                        </div>
                        <div className="text-sm font-medium whitespace-nowrap mt-1">
                          <ChangeText comparison={data.price_comparison} />
                        </div>
                      </div>
                      <div className="bg-base-200 rounded-lg py-3 px-1">
                        <div className="text-sm text-base-content/50 mb-1">최고가</div>
                        <div className="text-lg font-bold text-red-500 whitespace-nowrap">
                          {formatPrice(data.max_price)}
                        </div>
                        <div className="text-sm font-medium whitespace-nowrap mt-1">
                          <ChangeText comparison={data.max_price_comparison} />
                        </div>
                      </div>
                      <div className="bg-base-200 rounded-lg py-3 px-1">
                        <div className="text-sm text-base-content/50 mb-1">최저가</div>
                        <div className="text-lg font-bold text-blue-500 whitespace-nowrap">
                          {formatPrice(data.min_price)}
                        </div>
                        <div className="text-sm font-medium whitespace-nowrap mt-1">
                          <ChangeText comparison={data.min_price_comparison} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritePrices;
