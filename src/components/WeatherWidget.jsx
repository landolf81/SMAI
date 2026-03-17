import React, { useState, useEffect } from 'react';
import { weatherService } from '../services/weatherService';

const WeatherWidget = ({ onClick }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        const data = await weatherService.getWeatherData(false); // 기본 위치(선남) 사용
        setWeather(data);
      } catch (error) {
        console.error('날씨 데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();

    // 30분마다 새로고침
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 현재 시각에 가장 가까운 예보 온도 가져오기
  const getCurrentTemp = () => {
    if (!weather) return null;

    // shortTerm에서 현재 시각에 맞는 예보 찾기
    if (weather.shortTerm && weather.shortTerm.length > 0) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentDate = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      const currentTime = String(currentHour).padStart(2, '0') + '00';

      // 정확히 일치하는 시간 또는 가장 가까운 과거 시간 찾기
      let bestMatch = null;
      for (const forecast of weather.shortTerm) {
        const forecastDateTime = forecast.date + forecast.time;
        const currentDateTime = currentDate + currentTime;

        if (forecastDateTime <= currentDateTime) {
          bestMatch = forecast;
        } else if (forecastDateTime > currentDateTime && !bestMatch) {
          // 아직 bestMatch가 없고 미래 예보라면 그것을 사용
          bestMatch = forecast;
          break;
        }
      }

      if (bestMatch && bestMatch.temp !== null) {
        return bestMatch.temp;
      }
    }

    // shortTerm에서 찾지 못하면 current.temp 사용
    return weather.current?.temp ?? null;
  };

  // 날씨 아이콘 결정
  const getIcon = () => {
    if (!weather?.shortTerm?.length && !weather?.current) return '☀️';

    // shortTerm에서 현재 시각에 맞는 예보 찾기
    if (weather.shortTerm && weather.shortTerm.length > 0) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentDate = now.toISOString().slice(0, 10).replace(/-/g, '');
      const currentTime = String(currentHour).padStart(2, '0') + '00';

      for (const forecast of weather.shortTerm) {
        const forecastDateTime = forecast.date + forecast.time;
        const currentDateTime = currentDate + currentTime;

        if (forecastDateTime >= currentDateTime) {
          const iconData = weatherService.getWeatherIconFromCode(forecast.sky, forecast.pty);
          return iconData?.icon || '☀️';
        }
      }
    }

    // fallback
    const pty = weather.current?.pty || 0;
    const sky = weather.shortTerm?.[0]?.sky || 1;
    const iconData = weatherService.getWeatherIconFromCode(sky, pty);
    return iconData?.icon || '☀️';
  };

  const currentTemp = getCurrentTemp();

  // CLS 방지: 로딩 중에도 동일 크기 placeholder 유지
  if (loading || currentTemp === null) {
    return (
      <div className="flex items-center gap-1" style={{ visibility: 'hidden' }}>
        <span className="text-xl">☀️</span>
        <span className="text-base-content text-base font-bold">--°</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 active:scale-95"
    >
      <span className="text-xl">{getIcon()}</span>
      <span className="text-base-content text-base font-bold">{currentTemp}°</span>
    </button>
  );
};

export default WeatherWidget;
