// API 응답 캐싱 및 최적화 유틸리티
import { makeRequest } from '../axios';

// 캐시 저장소
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 캐시 키 생성
const generateCacheKey = (url, params = {}) => {
  const paramString = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return `${url}${paramString ? `?${paramString}` : ''}`;
};

// 캐시된 요청
export const cachedRequest = async (url, options = {}) => {
  const { useCache = true, cacheDuration = CACHE_DURATION, ...axiosOptions } = options;
  const cacheKey = generateCacheKey(url, axiosOptions.params);

  // 캐시 확인
  if (useCache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < cacheDuration) {
      return cached.data;
    }
    cache.delete(cacheKey);
  }

  try {
    const response = await makeRequest.get(url, axiosOptions);
    
    // 성공적인 응답만 캐시
    if (useCache && response.status === 200) {
      cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
    }
    
    return response.data;
  } catch (error) {
    console.error(`API 요청 실패: ${url}`, error);
    throw error;
  }
};

// 시장 데이터 API (캐싱 적용)
export const marketAPI = {
  // 실시간 가격 정보 (30초 캐시)
  getRealTimePrices: (markets = []) => 
    cachedRequest('/markets/realtime', { 
      params: { markets: markets.join(',') },
      cacheDuration: 30 * 1000 
    }),

  // 시장 목록 (5분 캐시)
  getMarkets: () => 
    cachedRequest('/markets', { cacheDuration: 5 * 60 * 1000 }),

  // 가격 동향 (1분 캐시)
  getPriceTrends: (market, item, days = 7) =>
    cachedRequest('/markets/trends', {
      params: { market, item, days },
      cacheDuration: 60 * 1000
    }),

  // 시장 상세 정보 (2분 캐시)
  getMarketDetail: (marketId) =>
    cachedRequest(`/markets/${marketId}`, { 
      cacheDuration: 2 * 60 * 1000 
    }),
};

// 캐시 관리 함수들
export const cacheUtils = {
  // 특정 패턴의 캐시 삭제
  clearCache: (pattern) => {
    const keys = Array.from(cache.keys());
    keys.forEach(key => {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    });
  },

  // 전체 캐시 삭제
  clearAllCache: () => {
    cache.clear();
  },

  // 만료된 캐시 정리
  cleanupExpiredCache: () => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        cache.delete(key);
      }
    }
  }
};

// 에러 재시도 로직
export const retryRequest = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // 네트워크 에러가 아니면 재시도하지 않음
      if (error.response && error.response.status < 500) {
        throw error;
      }
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
};

export default {
  marketAPI,
  cacheUtils,
  retryRequest
};
