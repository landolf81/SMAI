// 날씨 데이터 공유 훅
// 여러 컴포넌트(WeatherWidget, WeatherModal, home 등)가 각자 weather_cache를
// 중복 조회하던 문제를 해결 — react-query의 동일 쿼리키로 단일 fetch 결과를 공유한다.
import { useQuery } from '@tanstack/react-query';
import { weatherService } from '../services/weatherService';

// 모든 소비자가 공유하는 쿼리키 (단일 캐시 엔트리)
export const WEATHER_QUERY_KEY = ['weather', 'default'];

// cron이 매시간 weather_cache를 채우므로 30분 staleTime이면 재조회 빈도가 충분히 낮다.
const WEATHER_STALE_MS = 30 * 60 * 1000;

// getWeatherData는 캐시 없음+쿨다운 시 null을 반환할 수 있다(소비 측에서 null 처리).
export function useWeather(options = {}) {
  return useQuery({
    queryKey: WEATHER_QUERY_KEY,
    queryFn: () => weatherService.getWeatherData(),
    staleTime: WEATHER_STALE_MS,
    refetchOnWindowFocus: false,
    ...options,
  });
}

export default useWeather;
