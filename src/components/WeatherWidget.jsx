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

  // 날씨 아이콘 결정
  const getIcon = () => {
    if (!weather?.current) return '☀️';
    const { pty } = weather.current;
    const sky = weather.shortTerm?.[0]?.sky || 1;

    const iconData = weatherService.getWeatherIconFromCode(sky, pty);
    return iconData?.icon || '☀️';
  };

  // 로딩 중이거나 데이터 없으면 아무것도 표시하지 않음
  if (loading || !weather?.current) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 active:scale-95"
    >
      <span className="text-xl">{getIcon()}</span>
      <span className="text-gray-700 text-base font-bold">{weather.current.temp}°</span>
    </button>
  );
};

export default WeatherWidget;
