import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { marketService } from '../services';

const Prices = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // URL 파라미터에서 시장명과 날짜 가져오기
  const marketName = searchParams.get('market');
  const urlDate = searchParams.get('date');
  const [selectedDate, setSelectedDate] = useState(
    urlDate || new Date().toISOString().split('T')[0]
  );

  // 경락가 데이터 가져오기
  const fetchMarketData = async (market, date) => {
    try {
      setLoading(true);
      setError(null);

      if (!market) {
        throw new Error('시장명이 지정되지 않았습니다.');
      }

      const data = await marketService.getMarketDataWithComparison(market, date);
      setMarketData(data);

    } catch (error) {
      console.error('Market data 조회 실패:', error);
      setError(error.message || '데이터를 불러올 수 없습니다.');
      setMarketData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (marketName) {
      fetchMarketData(marketName, selectedDate);
    } else {
      setLoading(false);
      setError('시장을 선택해주세요.');
    }
  }, [marketName, selectedDate]);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    
    // URL 파라미터 업데이트
    const newParams = new URLSearchParams(searchParams);
    newParams.set('date', newDate);
    setSearchParams(newParams);
  };

  const handleRefresh = () => {
    if (marketName) {
      fetchMarketData(marketName, selectedDate);
    }
  };

  const formatPrice = (price) => {
    return price ? price.toLocaleString('ko-KR') : '0';
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="mt-4 text-gray-600">경락가격 정보를 불러오는 중...</p>
          {marketName && (
            <p className="text-sm text-gray-500 mt-2">{marketName} - {selectedDate}</p>
          )}
        </div>
      </div>
    );
  }

  if (error || !marketName) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="w-full max-w-screen-xl mx-auto p-4">
          <div className="text-center py-12">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto">
              <div className="text-blue-600 mb-4">
                <HomeIcon className="w-12 h-12 mx-auto mb-3" />
              </div>
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                {!marketName ? '시장을 선택해주세요' : '데이터를 불러올 수 없습니다'}
              </h3>
              <p className="text-blue-600 text-sm mb-4">
                {!marketName 
                  ? '홈에서 원하는 시장의 경락카드를 클릭하여 가격 정보를 확인하세요.' 
                  : error
                }
              </p>
              <div className="space-y-2">
                <Link 
                  to="/"
                  className="btn btn-primary"
                >
                  홈으로 돌아가기
                </Link>
                {marketName && (
                  <button 
                    onClick={handleRefresh}
                    className="btn btn-outline"
                  >
                    다시 시도
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b sticky top-16 z-10">
        <div className="w-full max-w-screen-xl mx-auto p-4">
          <div className="flex items-center justify-center relative">
            {/* 뒤로가기 버튼 */}
            <Link
              to="/"
              className="absolute left-0 text-[#004225] text-2xl font-bold hover:opacity-70 transition-opacity"
              title="홈으로"
            >
              &lt;
            </Link>

            {/* 날짜 중앙 정렬 */}
            <div className="flex items-center gap-2">
              <CalendarTodayIcon fontSize="small" className="text-[#004225]" />
              <span className="text-base font-medium text-gray-800">
                {formatDate(selectedDate)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="w-full max-w-screen-xl mx-auto p-4">
        {!marketData || !marketData.details || marketData.details.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                경락가 데이터가 없습니다
              </h3>
              <p className="text-yellow-600 text-sm mb-4">
                {formatDate(selectedDate)}에 <strong>{marketName}</strong>의 거래 데이터가 없습니다.
              </p>
              <div className="space-y-2 mb-4">
                <p className="text-yellow-600 text-xs">
                  • 주말이나 휴일에는 경매가 진행되지 않습니다
                </p>
                <p className="text-yellow-600 text-xs">
                  • 평일 오전 6시~오후 2시에 거래가 진행됩니다
                </p>
                <p className="text-yellow-600 text-xs">
                  • 계절에 따라 거래 품목이 달라질 수 있습니다
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      const newDate = new Date().toISOString().split('T')[0];
                      setSelectedDate(newDate);
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('date', newDate);
                      setSearchParams(newParams);
                    }}
                    className="btn btn-sm btn-outline border-[#004225] text-[#004225] hover:bg-[#004225] hover:text-white"
                  >
                    오늘 데이터 보기
                  </button>
                  <button
                    onClick={() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      const newDate = yesterday.toISOString().split('T')[0];
                      setSelectedDate(newDate);
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('date', newDate);
                      setSearchParams(newParams);
                    }}
                    className="btn btn-sm bg-[#004225] text-white hover:bg-[#003018] border-none"
                  >
                    어제 데이터 보기
                  </button>
                </div>
                <Link
                  to="/"
                  className="btn bg-[#004225] text-white hover:bg-[#003018] border-none"
                >
                  홈으로 돌아가기
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 요약 정보 - 카드 형태 */}
            {marketData.summary && (
              <div className="relative pt-4 mb-6">
                {/* 공판장명 뱃지 - 카드 위에 걸쳐있는 형태 */}
                <div className="absolute -top-0 left-4 z-10">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004225] text-white text-sm font-bold rounded-full shadow-md">
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                    {marketName}
                  </span>
                </div>

                {/* 카드 본체 */}
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 pt-6 pb-4 px-4">
                  {/* 날짜 정보 */}
                  <div className="text-xs text-gray-500 mb-3">
                    {formatDate(selectedDate)} 거래 요약
                  </div>

                  {/* 요약 정보 그리드 */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {/* 총 출하량 */}
                    <div className="bg-gray-50 rounded-lg py-3 px-2">
                      <div className="text-xs text-gray-500 mb-1">총 출하량</div>
                      <div className="text-base font-bold text-gray-800">
                        {formatPrice(marketData.summary.total_boxes)}상자
                      </div>
                    </div>

                    {/* 평균가 */}
                    <div className="bg-gray-50 rounded-lg py-3 px-2">
                      <div className="text-xs text-gray-500 mb-1">평균가</div>
                      <div className="text-base font-bold text-[#004225]">
                        {formatPrice(marketData.summary.overall_avg_price)}원
                      </div>
                    </div>

                    {/* 전일대비 */}
                    <div className="bg-gray-50 rounded-lg py-3 px-2">
                      <div className="text-xs text-gray-500 mb-1">전일대비</div>
                      <div className={`text-base font-bold ${
                        !marketData.overall_comparison?.comparison_available ? 'text-gray-400' :
                        Math.abs(marketData.overall_comparison.changePercent) < 0.1 ? 'text-gray-600' :
                        marketData.overall_comparison.change > 0 ? 'text-red-500' : 'text-blue-500'
                      }`}>
                        {!marketData.overall_comparison?.comparison_available ? '-' :
                         Math.abs(marketData.overall_comparison.changePercent) < 0.1 ? '0' :
                         `${marketData.overall_comparison.change > 0 ? '▲' : '▼'} ${Math.abs(marketData.overall_comparison.change).toLocaleString()}`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 상세 가격 정보 - 카드 형태 */}
            <div className="space-y-6">
              {marketData.details.map((item, index) => {
                const priceComparison = item.price_comparison || {
                  change: 0,
                  changePercent: 0,
                  comparison_available: false
                };

                return (
                  <div key={index} className="relative pt-4">
                    {/* 등급 뱃지 - 카드 위에 걸쳐있는 형태 */}
                    <div className="absolute -top-0 left-4 z-10">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004225] text-white text-sm font-bold rounded-full shadow-md">
                        <span className="w-2 h-2 bg-white rounded-full"></span>
                        {item.grade}
                      </span>
                    </div>

                    {/* 카드 본체 */}
                    <div className="bg-white rounded-2xl shadow-md border border-gray-100 pt-6 pb-4 px-4">
                      {/* 품목 정보 */}
                      <div className="text-sm text-gray-600 mb-3">
                        참외 {item.weight} · 수량 <span className="font-semibold text-gray-800">{formatPrice(item.boxes)}상자</span>
                      </div>

                      {/* 가격 정보 그리드 */}
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {/* 평균가 */}
                        <div className="bg-gray-50 rounded-lg py-3 px-2">
                          <div className="text-xs text-gray-500 mb-1">평균가</div>
                          <div className="text-base font-bold text-[#004225]">
                            {formatPrice(item.avg_price)}원
                          </div>
                        </div>

                        {/* 전일대비 */}
                        <div className="bg-gray-50 rounded-lg py-3 px-2">
                          <div className="text-xs text-gray-500 mb-1">전일대비</div>
                          <div className={`text-base font-bold ${
                            !priceComparison.comparison_available ? 'text-gray-400' :
                            Math.abs(priceComparison.changePercent) < 0.1 ? 'text-gray-600' :
                            priceComparison.change > 0 ? 'text-red-500' : 'text-blue-500'
                          }`}>
                            {!priceComparison.comparison_available ? '-' :
                             Math.abs(priceComparison.changePercent) < 0.1 ? '0' :
                             `${priceComparison.change > 0 ? '▲' : '▼'} ${Math.abs(priceComparison.change).toLocaleString()}`
                            }
                          </div>
                        </div>

                        {/* 최고가 */}
                        <div className="bg-gray-50 rounded-lg py-3 px-2">
                          <div className="text-xs text-gray-500 mb-1">최고가</div>
                          <div className="text-base font-bold text-red-500">
                            {formatPrice(item.max_price)}원
                          </div>
                        </div>

                        {/* 최저가 */}
                        <div className="bg-gray-50 rounded-lg py-3 px-2">
                          <div className="text-xs text-gray-500 mb-1">최저가</div>
                          <div className="text-base font-bold text-blue-500">
                            {formatPrice(item.min_price)}원
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </>
        )}
      </div>
    </div>
  );
};

export default Prices;