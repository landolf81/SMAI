import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adService } from '../services';
import MobileAdDisplay from './MobileAdDisplay';
import { shouldShowAds, isMobileDevice, isTabletDevice } from '../utils/deviceDetector';
import { AuthContext } from '../context/AuthContext';

const MarketCards = ({ marketData, loading, selectedDate, formatPrice, formatDateForDisplay, handleRefresh }) => {
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const [showLoginModal, setShowLoginModal] = useState(false);


  // 활성 광고 데이터 가져오기 (모바일에서만)
  const { data: adsData, error: adsError, isLoading: adsLoading } = useQuery({
    queryKey: ['ads', 'active', 'market'],
    queryFn: () => adService.getActiveAds('market'),
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    enabled: shouldShowAds(), // PC에서는 쿼리 비활성화
    retry: 2, // 재시도 횟수
    onError: (error) => {
      console.error('❌ 광고 API 에러:', error);
    }
  });

  const handleCardClick = (marketName) => {
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }
    navigate(`/prices?market=${encodeURIComponent(marketName)}&date=${selectedDate}`);
  };

  // 공판장별 색상 테마 정의
  const getMarketTheme = (marketName) => {
    const themes = {
      // 가락공판장 - 파란색
      '가락': { 
        bg: 'from-blue-500 to-blue-600', 
        text: 'text-blue-600',
        light: 'bg-blue-50'
      },
      // 선남농협 - 녹색
      '선남': { 
        bg: 'from-green-500 to-green-600', 
        text: 'text-green-600',
        light: 'bg-green-50'
      },
      // 성주원예 - 주황색
      '성주원예': { 
        bg: 'from-orange-500 to-orange-600', 
        text: 'text-orange-600',
        light: 'bg-orange-50'
      },
      // 성주조공 - 빨간색
      '성주조공': { 
        bg: 'from-red-500 to-red-600', 
        text: 'text-red-600',
        light: 'bg-red-50'
      },
      // 용암농협 - 노란색
      '용암': { 
        bg: 'from-yellow-500 to-yellow-600', 
        text: 'text-yellow-600',
        light: 'bg-yellow-50'
      },
      // 초전농협 - 핑크색
      '초전': { 
        bg: 'from-pink-500 to-pink-600', 
        text: 'text-pink-600',
        light: 'bg-pink-50'
      },
      // 기본 성주 농협들 - 녹색
      '성주': { 
        bg: 'from-green-500 to-green-600', 
        text: 'text-green-600',
        light: 'bg-green-50'
      }
    };

    // 시장명에서 키워드 매칭 (정확한 매칭)
    for (const [key, theme] of Object.entries(themes)) {
      if (marketName.includes(key)) {
        return theme;
      }
    }

    // 기본 테마 (성주/녹색)
    return themes['성주'];
  };

  // 카드 배경색 생성 함수
  const getCardBackgroundColor = (theme) => {
    const colorMap = {
      'from-blue-500 to-blue-600': 'rgba(59, 130, 246, 0.08)',      // 파란색
      'from-green-500 to-green-600': 'rgba(34, 197, 94, 0.08)',     // 녹색
      'from-orange-500 to-orange-600': 'rgba(249, 115, 22, 0.08)',  // 주황색
      'from-red-500 to-red-600': 'rgba(239, 68, 68, 0.08)',         // 빨간색
      'from-yellow-500 to-yellow-600': 'rgba(234, 179, 8, 0.08)',   // 노란색
      'from-pink-500 to-pink-600': 'rgba(236, 72, 153, 0.08)',      // 핑크색
    };
    
    return colorMap[theme.bg] || 'rgba(34, 197, 94, 0.08)'; // 기본값: 녹색
  };

  // 등락률 계산 및 표시 함수
  const renderPriceChange = (currentPrice, previousPrice, unit = '원') => {
    if (!previousPrice || previousPrice === 0) return null;
    
    const change = currentPrice - previousPrice;
    const changePercent = (change / previousPrice) * 100;
    const isPositive = change > 0;
    const isNegative = change < 0;
    
    if (change === 0) return <span className="text-gray-500 text-xs">보합</span>;
    
    return (
      <div className="flex items-center space-x-1 text-xs">
        <span className={isPositive ? 'text-red-500' : 'text-blue-500'}>
          {isPositive ? '▲' : '▼'}
        </span>
        <span className={isPositive ? 'text-red-500' : 'text-blue-500'}>
          {Math.abs(change).toLocaleString()}{unit} ({Math.abs(changePercent).toFixed(1)}%)
        </span>
      </div>
    );
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 loading-container safe-area-top safe-area-bottom">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="mt-4 text-gray-600">경락가 정보를 불러오는 중...</p>
          <div className="mt-2 text-sm text-gray-500">
            {formatDateForDisplay(selectedDate)} 데이터 조회 중
          </div>
        </div>
      </div>
    );
  }

  if (!marketData || marketData.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 max-w-md mx-auto">
            <div className="mb-6">
              <img 
                src="/images/AS_110.png" 
                alt="경락가 정보 없음" 
                className="w-full h-auto mx-auto opacity-80 rounded-lg"
              />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-3">경락가 정보가 없습니다</h3>
          </div>
        </div>
        
        {/* 경락가 정보가 없을 때 광고 표시 */}
        {shouldShowAds() && adsData && adsData.length > 0 && (
          <div className="mt-4">
            <MobileAdDisplay 
              ad={adsData[0]}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* 모바일 전용 레이아웃 - 세로 스택 */}
      <div className="space-y-4 flex flex-col items-center">
        {marketData.map((market, index) => {
          const theme = getMarketTheme(market.name);
          return (
          <React.Fragment key={market.id}>
            <div 
              className="w-full max-w-md mx-auto bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 haptic-feedback no-select market-card cursor-pointer"
              onClick={() => handleCardClick(market.name)}
              style={{ 
                boxShadow: `-4px 0 15px ${theme.bg.includes('blue') ? 'rgba(59, 130, 246, 0.25)' : 
                            theme.bg.includes('green') ? 'rgba(34, 197, 94, 0.25)' : 
                            theme.bg.includes('orange') ? 'rgba(249, 115, 22, 0.25)' : 
                            theme.bg.includes('red') ? 'rgba(239, 68, 68, 0.25)' : 
                            theme.bg.includes('yellow') ? 'rgba(234, 179, 8, 0.25)' : 
                            theme.bg.includes('pink') ? 'rgba(236, 72, 153, 0.25)' : 
                            'rgba(59, 130, 246, 0.25)'}, 0 4px 15px rgba(0, 0, 0, 0.1)`
              }}
            >
            {/* 농협명 헤더 - 간소화 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 bg-gradient-to-r ${theme.bg} rounded-full flex items-center justify-center shadow-md`}>
                  <span className="text-white text-sm font-bold">🏪</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{market.name}</h2>
                  <span className="text-xs text-gray-500">경락 정보</span>
                </div>
              </div>
            </div>

            {/* 가격 정보 영역 - 카드 형태로 재구성 */}
            <div className="p-4 bg-gray-50">
              {market.error ? (
                <div className="text-center py-8">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">📊</span>
                    </div>
                    <div className="text-gray-500 text-sm font-medium">경락가 정보가 없습니다</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 총수량 */}
                  <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-gray-700">총수량</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-gray-900 text-base">
                          {formatPrice(market.totalQuantity)} {market.unit}
                        </span>
                        {market.previousTotalQuantity && renderPriceChange(market.totalQuantity, market.previousTotalQuantity, '상자')}
                      </div>
                    </div>
                  </div>
                  
                  {/* 평균가 */}
                  <div className="bg-gray-50 rounded-lg p-3 shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-gray-700">평균가</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-gray-900 text-base">
                          {formatPrice(market.averagePrice)} 원
                        </span>
                        {market.previousAveragePrice && renderPriceChange(market.averagePrice, market.previousAveragePrice)}
                      </div>
                    </div>
                  </div>
                  
                  {/* 최고가 */}
                  <div className="bg-red-50 rounded-lg p-3 shadow-sm border border-red-200">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-red-700">최고가</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-red-700 text-base">
                          {formatPrice(market.maxPrice)} 원
                        </span>
                        {market.previousMaxPrice && renderPriceChange(market.maxPrice, market.previousMaxPrice)}
                      </div>
                    </div>
                  </div>

                  {/* 최저가 */}
                  <div className="bg-blue-50 rounded-lg p-3 shadow-sm border border-blue-200">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-blue-700">최저가</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-blue-700 text-base">
                          {formatPrice(market.minPrice)} 원
                        </span>
                        {market.previousMinPrice && renderPriceChange(market.minPrice, market.previousMinPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 액션 버튼 - 광고 카드 스타일과 일관성 */}
              <div className="mt-4">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(market.name);
                  }}
                  className={`w-full bg-gradient-to-r ${theme.bg} text-white font-semibold py-3 px-4 rounded-lg hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5`}
                >
                  상세 가격 보기
                </button>
              </div>
            </div>
            </div>
            {/* 2개마다 광고 삽입 (2, 4, 6번째 카드 뒤) */}
            {shouldShowAds() && ((index + 1) % 2 === 0) && adsData && adsData.length > 0 && (
              <MobileAdDisplay
                ad={adsData[Math.floor(index / 2) % adsData.length]}
              />
            )}
          </React.Fragment>
          );
        })}

        {/* 최하단 광고 (경락 정보가 1개 이하일 때만 표시) */}
        {shouldShowAds() && adsData && adsData.length > 0 && marketData.length > 0 && marketData.length <= 1 && (
          <MobileAdDisplay
            ad={adsData[0]}
          />
        )}
      </div>
      {/* 로그인 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">로그인이 필요합니다</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                등급별 상세 경락가 정보를 확인하려면<br />
                로그인 또는 회원가입이 필요합니다.
              </p>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => {
                  setShowLoginModal(false);
                  navigate('/login');
                }}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200"
              >
                로그인하기
              </button>
              
              <button 
                onClick={() => {
                  setShowLoginModal(false);
                  navigate('/register');
                }}
                className="w-full bg-gray-100 text-gray-700 font-semibold py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
              >
                회원가입하기
              </button>
              
              <button 
                onClick={() => setShowLoginModal(false)}
                className="w-full text-gray-500 font-medium py-2 hover:text-gray-700 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MarketCards; 