import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StoreIcon from '@mui/icons-material/Store';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import { marketService } from '../services';

const Markets = () => {
  const [availableMarkets, setAvailableMarkets] = useState([]);
  const [marketDetails, setMarketDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // 실제 데이터가 있는 시장 목록 가져오기
  const fetchAvailableMarkets = async (date) => {
    try {
      const markets = await marketService.getAvailableMarkets(date);
      setAvailableMarkets(markets);
      return markets;
    } catch (error) {
      console.error('Available markets 조회 실패:', error);
      setAvailableMarkets([]);
      return [];
    }
  };

  // 시장별 기본 정보와 요약 데이터 가져오기
  const fetchMarketDetails = async (markets, date) => {
    try {
      if (markets.length === 0) {
        setMarketDetails([]);
        return;
      }

      const response = await marketService.getMultipleMarkets(markets, date);

      if (response && response.markets) {
        const details = response.markets.map((market, index) => {
          const hasData = market.success && market.data && market.data.details;
          
          return {
            id: index + 1,
            name: market.market_name,
            description: getMarketDescription(market.market_name),
            operatingHours: getOperatingHours(market.market_name),
            location: getMarketLocation(market.market_name),
            hasData: hasData,
            summary: hasData ? {
              totalBoxes: market.data.summary?.total_boxes || 0,
              totalAmount: market.data.summary?.total_amount || 0,
              avgPrice: market.data.summary?.overall_avg_price || 0,
              itemCount: market.data.details?.length || 0
            } : null,
            error: market.error || null
          };
        });
        
        setMarketDetails(details);
      }
    } catch (error) {
      console.error('Market details 조회 실패:', error);
      setMarketDetails([]);
    }
  };

  // 시장별 기본 정보 반환 (확장 가능)
  const getMarketDescription = (marketName) => {
    const descriptions = {
      '성주참외공판장': '성주군 대표 참외 경매장',
      '성주농협공판장': '농협 운영 종합 공판장',
      '성주중앙시장': '지역 중앙 농산물 시장',
      '서부농협공판장': '서부 지역 농협 공판장',
      '동부농협공판장': '동부 지역 농협 공판장'
    };
    return descriptions[marketName] || `${marketName} 농산물 거래소`;
  };

  const getOperatingHours = (marketName) => {
    const hours = {
      '성주참외공판장': '06:00 - 14:00',
      '성주농협공판장': '05:30 - 13:00', 
      '성주중앙시장': '24시간',
      '서부농협공판장': '06:00 - 13:30',
      '동부농협공판장': '05:00 - 13:00'
    };
    return hours[marketName] || '06:00 - 14:00';
  };

  const getMarketLocation = (marketName) => {
    const locations = {
      '성주참외공판장': '성주군 성주읍',
      '성주농협공판장': '성주군 성주읍',
      '성주중앙시장': '성주군 성주읍',
      '서부농협공판장': '성주군 서부',
      '동부농협공판장': '성주군 동부'
    };
    return locations[marketName] || '성주군';
  };

  // 데이터 로드
  const loadMarketData = async (date) => {
    setLoading(true);
    const markets = await fetchAvailableMarkets(date);
    await fetchMarketDetails(markets, date);
    setLoading(false);
  };

  useEffect(() => {
    loadMarketData(selectedDate);
  }, [selectedDate]);

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handleRefresh = () => {
    loadMarketData(selectedDate);
  };

  const formatPrice = (price) => {
    return price.toLocaleString('ko-KR');
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
          <p className="mt-4 text-gray-600">시장 정보를 불러오는 중...</p>
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
            <h1 className="text-2xl font-bold text-gray-800">시장 정보</h1>
            
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

          <p className="text-gray-600">
            {formatDate(selectedDate)}에 거래 데이터가 있는 농산물 시장들을 확인할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="w-full max-w-screen-xl mx-auto p-4">
        {marketDetails.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gradient-to-br from-blue-50 to-green-50 border border-blue-200 rounded-xl p-8 max-w-lg mx-auto shadow-lg">
              {/* 이미지 표시 */}
              <div className="mb-6">
                <img 
                  src="/images/AS_110.png" 
                  alt="경락 정보 없음" 
                  className="w-32 h-32 mx-auto rounded-lg shadow-md"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              
              <InfoIcon className="w-12 h-12 mx-auto mb-4 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                📊 경락 정보가 없습니다
              </h3>
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                <span className="font-semibold text-blue-700">{formatDate(selectedDate)}</span>에<br/>
                거래된 경락가 데이터가 없습니다.
              </p>
              
              <div className="bg-white rounded-lg p-4 mb-6 text-left">
                <h4 className="font-semibold text-gray-700 mb-2 text-center">💡 참고사항</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <p className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    평일 오전 6시~오후 2시에 경매가 진행됩니다
                  </p>
                  <p className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    주말이나 공휴일에는 거래가 없을 수 있습니다
                  </p>
                  <p className="flex items-center">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                    날씨나 시장 상황에 따라 휴장할 수 있습니다
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                  className="btn btn-outline btn-sm"
                >
                  📅 오늘 데이터 확인
                </button>
                <button
                  onClick={() => {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    setSelectedDate(yesterday.toISOString().split('T')[0]);
                  }}
                  className="btn btn-primary btn-sm"
                >
                  ⏮️ 어제 데이터 보기
                </button>
                <button
                  onClick={() => {
                    const dayBefore = new Date();
                    dayBefore.setDate(dayBefore.getDate() - 2);
                    setSelectedDate(dayBefore.toISOString().split('T')[0]);
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  📊 최근 데이터 찾기
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {marketDetails.map((market) => (
              <div key={market.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                {/* 시장 헤더 */}
                <div className={`p-4 rounded-t-lg ${market.hasData ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gray-400'}`}>
                  <div className="flex items-center gap-2 text-white">
                    <StoreIcon />
                    <h3 className="font-bold text-lg">{market.name}</h3>
                  </div>
                </div>
                
                {/* 시장 정보 */}
                <div className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <InfoIcon fontSize="small" className="text-gray-500 mt-0.5" />
                      <p className="text-gray-600 text-sm">{market.description}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <LocationOnIcon fontSize="small" className="text-gray-500" />
                      <p className="text-gray-600 text-sm">{market.location}</p>
                    </div>
                    
                    <div className="border-t pt-3">
                      <p className="text-gray-500 text-xs mb-2">운영시간</p>
                      <p className="font-medium text-market-600">{market.operatingHours}</p>
                    </div>

                    {/* 거래 요약 정보 */}
                    {market.hasData && market.summary && (
                      <div className="border-t pt-3">
                        <p className="text-gray-500 text-xs mb-2">오늘의 거래 요약</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">총 출수량:</span>
                            <p className="font-semibold">{formatPrice(market.summary.totalBoxes)} 상자</p>
                          </div>
                          <div>
                            <span className="text-gray-500">평균 가격:</span>
                            <p className="font-semibold text-green-600">{formatPrice(market.summary.avgPrice)} 원</p>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          총 {market.summary.itemCount}개 품목 거래
                        </div>
                      </div>
                    )}

                    {!market.hasData && (
                      <div className="border-t pt-3">
                        <div className="text-center py-3">
                          <img 
                            src="/images/AS_110.png" 
                            alt="데이터 없음" 
                            className="w-16 h-16 mx-auto mb-3 rounded opacity-75"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <p className="text-gray-500 text-sm mb-3 font-medium">
                            📊 선택한 날짜에<br/>경락 데이터가 없습니다
                          </p>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                              className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                            >
                              📅 오늘 확인
                            </button>
                            <button
                              onClick={() => {
                                const yesterday = new Date();
                                yesterday.setDate(yesterday.getDate() - 1);
                                setSelectedDate(yesterday.toISOString().split('T')[0]);
                              }}
                              className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
                            >
                              ⏮️ 어제 데이터
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* 상세보기 버튼 */}
                  <div className="mt-4 pt-3 border-t">
                    <Link 
                      to={`/prices?market=${encodeURIComponent(market.name)}&date=${selectedDate}`}
                      className={`w-full btn ${market.hasData ? 'btn-primary' : 'btn-disabled'}`}
                    >
                      {market.hasData ? '상세 경락가 보기' : '데이터 없음'}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 하단 정보 */}
        {marketDetails.length > 0 && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border">
              <StoreIcon fontSize="small" className="text-green-600" />
              <span className="text-sm text-gray-600">
                총 {marketDetails.length}개 시장에서 {formatDate(selectedDate)} 거래 진행
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Markets;