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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link 
                to="/"
                className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="홈으로"
              >
                <ArrowBackIcon fontSize="small" />
              </Link>
              
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  {marketName}
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <CalendarTodayIcon fontSize="small" className="text-gray-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  max={new Date().toISOString().split('T')[0]}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <button
                onClick={handleRefresh}
                className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="새로고침"
              >
                <RefreshIcon fontSize="small" />
              </button>
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
                    className="btn btn-sm btn-outline"
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
                    className="btn btn-sm btn-primary"
                  >
                    어제 데이터 보기
                  </button>
                </div>
                <Link 
                  to="/"
                  className="btn btn-primary"
                >
                  홈으로 돌아가기
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 요약 정보 */}
            {marketData.summary && (
              <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
                <div
                  className="px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white"
                >
                  <h2 className="text-xl font-semibold">
                    {formatDate(selectedDate)} 거래 요약
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-gray-500 text-sm">총 출수량</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {formatPrice(marketData.summary.total_boxes)} 상자
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-gray-500 text-sm">총 거래금액</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatPrice(marketData.summary.total_amount)} 원
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-gray-500 text-sm">전체 평균 가격</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatPrice(marketData.summary.overall_avg_price)} 원
                      </p>
                    </div>
                    {/* 전체 평균 등락률 표시 */}
                    {marketData.overall_comparison && marketData.overall_comparison.comparison_available && (
                      <div className={`flex items-center justify-end text-sm ${
                        Math.abs(marketData.overall_comparison.changePercent) < 0.1 ? 'text-gray-600' :
                        marketData.overall_comparison.change > 0 ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {Math.abs(marketData.overall_comparison.changePercent) < 0.1 ? (
                          <TrendingFlatIcon fontSize="small" />
                        ) : marketData.overall_comparison.change > 0 ? (
                          <TrendingUpIcon fontSize="small" />
                        ) : (
                          <TrendingDownIcon fontSize="small" />
                        )}
                        <span className="ml-1 font-medium">
                          {Math.abs(marketData.overall_comparison.changePercent) < 0.1 ? '변동 없음' :
                           `${marketData.overall_comparison.change > 0 ? '+' : ''}${formatPrice(marketData.overall_comparison.change)}원 (${marketData.overall_comparison.changePercent > 0 ? '+' : ''}${marketData.overall_comparison.changePercent}%)`
                          }
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* 전 경매일 정보 */}
                  {marketData.previous_market_date && (
                    <div className="mt-4 text-center">
                      <div className="text-sm text-gray-500">
                        전 경매일: {formatDate(marketData.previous_market_date)} 대비
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 상세 가격 정보 - 테이블 형태 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="divide-y">
                {marketData.details.map((item, index) => {
                  const priceComparison = item.price_comparison || {
                    change: 0,
                    changePercent: 0,
                    comparison_available: false
                  };

                  return (
                    <div
                      key={index}
                      className="p-4"
                    >
                      {/* 테이블 형태 레이아웃 */}
                      <table className="w-full text-sm">
                        <tbody>
                          {/* 품목명 | 평균가격 */}
                          <tr>
                            <td className="py-1">
                              <span className="text-lg font-bold text-gray-800">
                                참외 {item.weight} {item.grade}
                              </span>
                            </td>
                            <td className="py-1 text-right">
                              <span className="text-xl font-bold text-gray-800">
                                {formatPrice(item.avg_price)} 원
                              </span>
                            </td>
                          </tr>
                          {/* 전 경매일 데이터비교 (상승/하강 표시) */}
                          <tr>
                            <td className="py-1"></td>
                            <td className="py-1 text-right">
                              {priceComparison.comparison_available ? (
                                <span className={`flex items-center justify-end gap-1 ${
                                  Math.abs(priceComparison.changePercent) < 0.1 ? 'text-gray-600' :
                                  priceComparison.change > 0 ? 'text-red-600' : 'text-blue-600'
                                }`}>
                                  {Math.abs(priceComparison.changePercent) < 0.1 ? (
                                    <>
                                      <TrendingFlatIcon fontSize="small" />
                                      <span>변동없음</span>
                                    </>
                                  ) : priceComparison.change > 0 ? (
                                    <>
                                      <TrendingUpIcon fontSize="small" />
                                      <span>+{formatPrice(priceComparison.change)}원</span>
                                    </>
                                  ) : (
                                    <>
                                      <TrendingDownIcon fontSize="small" />
                                      <span>{formatPrice(priceComparison.change)}원</span>
                                    </>
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400">전 경매일 데이터비교</span>
                              )}
                            </td>
                          </tr>
                          {/* 수량 */}
                          <tr>
                            <td className="py-1 text-gray-600">수량</td>
                            <td className="py-1 text-right text-gray-800">
                              {formatPrice(item.boxes)} 상자
                            </td>
                          </tr>
                          {/* 최고가 */}
                          <tr>
                            <td className="py-1 text-gray-600">최고가</td>
                            <td className="py-1 text-right text-red-600 font-medium">
                              {formatPrice(item.max_price)} 원
                            </td>
                          </tr>
                          {/* 최저가 */}
                          <tr>
                            <td className="py-1 text-gray-600">최저가</td>
                            <td className="py-1 text-right text-blue-600 font-medium">
                              {formatPrice(item.min_price)} 원
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 하단 액션 */}
            <div className="mt-6 text-center space-y-3">
              <div className="flex justify-center gap-3">
                <Link 
                  to="/"
                  className="btn btn-outline"
                >
                  홈으로 돌아가기
                </Link>
                <button 
                  onClick={handleRefresh}
                  className="btn btn-primary"
                >
                  새로고침
                </button>
              </div>
              
              <div className="text-sm text-gray-500">
                {formatDate(selectedDate)} 기준 데이터
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Prices;