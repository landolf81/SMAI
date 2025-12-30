import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { weatherService } from '../services/weatherService';
import LoadingSpinner from './LoadingSpinner';

const WeatherModal = ({ isOpen, onClose }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('today'); // today, hourly, weekly
  const scrollYRef = useRef(0);

  // 스크롤 잠금
  useEffect(() => {
    if (isOpen) {
      scrollYRef.current = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollYRef.current}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      window.scrollTo(0, scrollYRef.current);
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [isOpen]);

  // 날씨 데이터 로드
  useEffect(() => {
    if (!isOpen) return;

    const fetchWeather = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await weatherService.getWeatherData();
        setWeather(data);
      } catch (err) {
        console.error('날씨 데이터 로드 실패:', err);
        setError('날씨 정보를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [isOpen]);

  // 날짜 포맷
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const date = new Date(year, month - 1, day);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${parseInt(month)}/${parseInt(day)} (${days[date.getDay()]})`;
  };

  // 시간 포맷
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return `${timeStr.substring(0, 2)}시`;
  };

  // 날씨 아이콘 가져오기
  const getWeatherIcon = (sky, pty) => {
    return weatherService.getWeatherIconFromCode(sky, pty);
  };

  // 현재 시각에 가장 가까운 예보 데이터 가져오기
  const getCurrentForecast = () => {
    if (!weather?.shortTerm?.length) return null;

    const now = new Date();
    const currentHour = now.getHours();
    const currentDate = now.toISOString().slice(0, 10).replace(/-/g, '');
    const currentTime = String(currentHour).padStart(2, '0') + '00';

    let bestMatch = null;
    for (const forecast of weather.shortTerm) {
      const forecastDateTime = forecast.date + forecast.time;
      const currentDateTime = currentDate + currentTime;

      if (forecastDateTime <= currentDateTime) {
        bestMatch = forecast;
      } else if (forecastDateTime > currentDateTime && !bestMatch) {
        bestMatch = forecast;
        break;
      }
    }

    return bestMatch;
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-[10000] pt-16">
      <div
        className="bg-white w-full max-w-lg rounded-3xl max-h-[calc(100vh-5rem)] flex flex-col overflow-hidden animate-slide-down mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-t-3xl">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌤️</span>
            <div>
              <h2 className="font-bold text-lg">
                {weather?.location || '선남'} 날씨
              </h2>
              {weather?.updatedAt && (
                <p className="text-xs opacity-80">
                  {new Date(weather.updatedAt).getHours()}시 기준
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b">
          {[
            { id: 'today', label: '오늘' },
            { id: 'hourly', label: '시간별' },
            { id: 'weekly', label: '주간' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-4 pb-12">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-4xl mb-2">😢</p>
              <p>{error}</p>
            </div>
          ) : (
            <>
              {/* 오늘 탭 */}
              {activeTab === 'today' && (weather?.current || weather?.shortTerm?.length) && (() => {
                const currentForecast = getCurrentForecast();
                const currentTemp = currentForecast?.temp ?? weather.current?.temp;
                const currentSky = currentForecast?.sky || weather.shortTerm?.[0]?.sky || 1;
                const currentPty = currentForecast?.pty ?? weather.current?.pty ?? 0;
                const currentHumidity = currentForecast?.humidity ?? weather.current?.humidity;
                const currentWindSpeed = currentForecast?.windSpeed ?? weather.current?.windSpeed;
                const currentPrecipitation = weather.current?.precipitation || '0';
                const currentPop = currentForecast?.pop ?? 0;

                return (
                <div className="space-y-4">
                  {/* 현재 날씨 카드 */}
                  <div className="bg-gradient-to-br from-sky-100 to-blue-100 rounded-2xl p-6 text-center">
                    <div className="text-6xl mb-2">
                      {getWeatherIcon(currentSky, currentPty)?.icon || '☀️'}
                    </div>
                    <div className="text-5xl font-bold text-gray-800 mb-1">
                      {currentTemp}°
                    </div>
                    <div className="text-gray-600">
                      {getWeatherIcon(currentSky, currentPty)?.text || '맑음'}
                    </div>
                  </div>

                  {/* 상세 정보 */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-2xl mb-1">💧</div>
                      <div className="text-xs text-gray-500">습도</div>
                      <div className="font-bold text-gray-700">{currentHumidity || '--'}%</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-2xl mb-1">🌧️</div>
                      <div className="text-xs text-gray-500">강수확률</div>
                      <div className="font-bold text-gray-700">{currentPop}%</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-2xl mb-1">🌬️</div>
                      <div className="text-xs text-gray-500">풍속</div>
                      <div className="font-bold text-gray-700">{currentWindSpeed || '--'}m/s</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-2xl mb-1">☔</div>
                      <div className="text-xs text-gray-500">강수량</div>
                      <div className="font-bold text-gray-700">{currentPrecipitation}mm</div>
                    </div>
                  </div>

                  {/* 오늘 예보 요약 */}
                  {weather.daily?.[0] && (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <div className="text-sm text-gray-600 mb-2">오늘 예보</div>
                      <div className="flex justify-between items-center">
                        <span className="text-blue-600">
                          최저 {weather.daily[0].minTemp}°
                        </span>
                        <span className="text-red-500">
                          최고 {weather.daily[0].maxTemp}°
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                );
              })()}

              {/* 시간별 탭 */}
              {activeTab === 'hourly' && (
                <div className="space-y-2">
                  {weather?.shortTerm
                    ?.filter(hour => {
                      // 현재 시간 이후만 표시
                      const now = new Date();
                      const hourDate = new Date(
                        parseInt(hour.date.substring(0, 4)),
                        parseInt(hour.date.substring(4, 6)) - 1,
                        parseInt(hour.date.substring(6, 8)),
                        parseInt(hour.time.substring(0, 2))
                      );
                      return hourDate >= now;
                    })
                    .slice(0, 24)
                    .map((hour, idx) => (
                    <div
                      key={idx}
                      className="flex items-center p-3 bg-gray-50 rounded-xl"
                    >
                      {/* 시간 */}
                      <div className="w-16">
                        <div className="font-medium text-gray-800">
                          {formatTime(hour.time)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(hour.date)}
                        </div>
                      </div>
                      {/* 하늘 상태 */}
                      <div className="w-12 text-center">
                        <span className="text-2xl">
                          {getWeatherIcon(hour.sky, hour.pty)?.icon || '☀️'}
                        </span>
                      </div>
                      {/* 강수확률 */}
                      <div className={`w-14 text-center text-sm ${hour.pop > 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                        🌧️ {hour.pop}%
                      </div>
                      {/* 온도 */}
                      <div className="flex-1 text-right font-bold text-lg text-gray-800">
                        {hour.temp}°
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 주간 탭 */}
              {activeTab === 'weekly' && (
                <div className="space-y-2">
                  {/* 단기예보 (3일) + 중기예보 (4-10일) 통합 */}
                  {[...(weather?.daily || []), ...(weather?.midTerm || [])].map((day, idx) => (
                    <div
                      key={`weekly-${idx}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {day.icon || getWeatherIcon(day.sky, day.pty)?.icon || '☀️'}
                        </span>
                        <div>
                          <div className="font-medium text-gray-800">
                            {formatDate(day.date)}
                          </div>
                          {day.weather && (
                            <div className="text-xs text-gray-500">
                              {day.weather}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-xs min-w-[40px] ${day.pop > 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                          🌧️{day.pop ?? 0}%
                        </div>
                        <div className="flex items-center gap-2 min-w-[70px] justify-end">
                          <span className="text-blue-600">{day.minTemp ?? '--'}°</span>
                          <span className="text-red-500">{day.maxTemp ?? '--'}°</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {(!weather?.daily?.length && !weather?.midTerm?.length) && (
                    <div className="text-center py-8 text-gray-500">
                      주간 예보 데이터가 없습니다.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* 출처 표시 (공공데이터포털 이용허락 조건) */}
          {!loading && !error && (
            <div className="mt-4 pt-3 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">
                출처: 기상청 (공공데이터포털)
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-down {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </div>,
    document.body
  );
};

export default WeatherModal;
