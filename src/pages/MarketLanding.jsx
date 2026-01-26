import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { marketService } from '../services';
import LoadingSpinner from '../components/LoadingSpinner';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';

/**
 * 카카오톡 소식용 경락정보 랜딩페이지
 *
 * 용도: 카카오톡 메시지/소식에서 링크 클릭 시 보여지는 페이지
 * 특징: 전일대비 없이 오늘의 경락정보만 간결하게 표시
 */
const MarketLanding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL 파라미터에서 날짜 가져오기 (없으면 오늘)
  const dateParam = searchParams.get('date');
  const selectedDate = dateParam || new Date().toISOString().split('T')[0];

  const [marketData, setMarketData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 날짜 포맷 함수
  const formatDateForDisplay = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  // 가격 포맷 함수
  const formatPrice = (price) => {
    if (!price || price === 0) return '0';
    return parseInt(price).toLocaleString();
  };

  // 경락정보 로드
  useEffect(() => {
    const loadMarketData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 시장 설정 로드
        const settings = await marketService.getMarketSettings();

        // 해당 날짜에 데이터가 있는 시장 목록 가져오기
        const markets = await marketService.getAvailableMarkets(selectedDate);

        if (!markets || markets.length === 0) {
          setMarketData([]);
          setLoading(false);
          return;
        }

        // 경락 데이터 로드
        const response = await marketService.getMultipleMarkets(markets, selectedDate);

        if (response && response.markets) {
          const transformedData = response.markets.map((market, index) => {
            if (market.success && market.data && market.data.details) {
              const details = market.data.details;
              const totalQuantity = details.reduce((sum, item) => sum + (item.boxes || 0), 0);
              const avgPrice = market.data.summary?.overall_avg_price || 0;
              const minPrice = Math.min(...details.map(item => item.min_price || 0));
              const maxPrice = Math.max(...details.map(item => item.max_price || 0));

              return {
                id: `${market.market_name}-${index}`,
                name: market.market_name,
                totalQuantity: totalQuantity,
                totalAmount: market.data.summary?.total_amount || 0,
                averagePrice: avgPrice,
                minPrice: minPrice,
                maxPrice: maxPrice,
                unit: '상자',
                error: false
              };
            } else {
              return {
                id: `${market.market_name}-${index}`,
                name: market.market_name,
                error: true
              };
            }
          });

          // 시장 순서대로 정렬
          const orderArray = settings?.market_order || [];
          const sortedData = [...transformedData].sort((a, b) => {
            const indexA = orderArray.indexOf(a.name);
            const indexB = orderArray.indexOf(b.name);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return 0;
          });

          setMarketData(sortedData);
        } else {
          setMarketData([]);
        }
      } catch (err) {
        console.error('경락정보 로드 실패:', err);
        setError('경락정보를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadMarketData();
  }, [selectedDate]);

  // 앱으로 이동
  const handleGoToApp = () => {
    navigate('/');
  };

  // 상세 페이지로 이동
  const handleViewDetail = (marketName) => {
    navigate(`/prices?market=${encodeURIComponent(marketName)}&date=${selectedDate}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto" />
          <p className="mt-4 text-gray-600">경락정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">오류가 발생했습니다</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={handleGoToApp}
            className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-6 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            참외이야기 홈으로
          </button>
        </div>
      </div>
    );
  }

  if (!marketData || marketData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">경락정보가 없습니다</h2>
          <p className="text-gray-600 mb-6">
            {formatDateForDisplay(selectedDate)}의<br />
            경락 데이터가 아직 업데이트되지 않았습니다.
          </p>
          <button
            onClick={handleGoToApp}
            className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-6 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            참외이야기 홈으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <img src="/logo.svg" alt="참외이야기" className="w-8 h-8" />
                <h1 className="text-lg font-bold text-gray-800">참외이야기</h1>
              </div>
              <p className="text-sm text-gray-600">{formatDateForDisplay(selectedDate)}</p>
            </div>
            <button
              onClick={handleGoToApp}
              className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow hover:shadow-md transition-all flex items-center gap-1"
            >
              앱으로 가기
              <ChevronRightRoundedIcon style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
      </div>

      {/* 경락정보 카드 리스트 */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {marketData.map((market) => (
          <div
            key={market.id}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300"
          >
            {/* 공판장명 헤더 */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-white rounded-full"></span>
                  <h2 className="text-xl font-bold text-white">{market.name}</h2>
                </div>
              </div>
            </div>

            {/* 가격 정보 */}
            {market.error ? (
              <div className="px-6 py-8 text-center">
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📊</span>
                  </div>
                  <p className="text-gray-500 font-medium">경락가 정보가 없습니다</p>
                </div>
              </div>
            ) : (
              <div className="px-6 py-6">
                {/* 총 출하량 & 총 출하금액 */}
                <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-700 font-medium">총 출하량</span>
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-bold text-gray-900">
                        {formatPrice(market.totalQuantity)}
                      </span>
                      <span className="text-sm text-gray-600">{market.unit}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 font-medium">총 출하금액</span>
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-bold text-gray-900">
                        {formatPrice(market.totalAmount)}
                      </span>
                      <span className="text-sm text-gray-600">원</span>
                    </div>
                  </div>
                </div>

                {/* 가격 정보 그리드 */}
                <div className="grid grid-cols-3 gap-3">
                  {/* 평균가 */}
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-xs text-gray-500 mb-2">평균가</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatPrice(market.averagePrice)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">원</div>
                  </div>

                  {/* 최고가 */}
                  <div className="bg-red-50 rounded-xl p-4 text-center">
                    <div className="text-xs text-red-600 mb-2">최고가</div>
                    <div className="text-2xl font-bold text-red-600">
                      {formatPrice(market.maxPrice)}
                    </div>
                    <div className="text-xs text-red-400 mt-1">원</div>
                  </div>

                  {/* 최저가 */}
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <div className="text-xs text-blue-600 mb-2">최저가</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatPrice(market.minPrice)}
                    </div>
                    <div className="text-xs text-blue-400 mt-1">원</div>
                  </div>
                </div>

                {/* 상세보기 버튼 */}
                <button
                  onClick={() => handleViewDetail(market.name)}
                  className="w-full mt-6 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold py-3.5 px-4 rounded-xl hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  등급별 상세가격 보기
                  <ChevronRightRoundedIcon style={{ fontSize: 20 }} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 푸터 */}
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="mb-4">
          <img src="/logo.svg" alt="참외이야기" className="w-16 h-16 mx-auto opacity-50" />
        </div>
        <p className="text-gray-500 text-sm mb-4">
          성주군 농업인을 위한 커뮤니티 플랫폼
        </p>
        <button
          onClick={handleGoToApp}
          className="bg-white text-blue-600 px-6 py-3 rounded-full font-semibold border-2 border-blue-600 hover:bg-blue-50 transition-all"
        >
          참외이야기 앱에서 더 보기
        </button>
      </div>
    </div>
  );
};

export default MarketLanding;
