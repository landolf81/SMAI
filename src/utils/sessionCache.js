/**
 * 세션 캐싱 유틸리티
 * Supabase auth.getSession() 호출을 최소화하여 API 요청 감소
 */

import { supabase } from '../config/supabase.js';

// 캐시 저장소
let cachedSession = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1분 캐시 (토큰 갱신 주기보다 짧게)

// 진행 중인 요청 (중복 요청 방지)
let pendingRequest = null;

/**
 * 캐시된 세션 가져오기
 * - 캐시가 유효하면 캐시 반환
 * - 캐시가 만료되었으면 새로 조회
 * - 동시 요청 시 하나의 요청만 실행
 */
export const getCachedSession = async () => {
  const now = Date.now();

  // 캐시가 유효하면 반환
  if (cachedSession && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedSession;
  }

  // 이미 진행 중인 요청이 있으면 대기
  if (pendingRequest) {
    return pendingRequest;
  }

  // 새 요청 시작
  pendingRequest = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      cachedSession = session;
      cacheTimestamp = Date.now();
      return session;
    } finally {
      pendingRequest = null;
    }
  })();

  return pendingRequest;
};

/**
 * 캐시된 사용자 정보 가져오기
 */
export const getCachedUser = async () => {
  const session = await getCachedSession();
  return session?.user || null;
};

/**
 * 캐시 무효화 (로그인/로그아웃 시 호출)
 */
export const invalidateSessionCache = () => {
  cachedSession = null;
  cacheTimestamp = 0;
  pendingRequest = null;
};

/**
 * 세션 캐시 업데이트 (로그인 성공 시 호출)
 */
export const updateSessionCache = (session) => {
  cachedSession = session;
  cacheTimestamp = Date.now();
};

// Auth 상태 변경 시 캐시 자동 갱신
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    invalidateSessionCache();
  } else if (session) {
    updateSessionCache(session);
  }
});

export default {
  getCachedSession,
  getCachedUser,
  invalidateSessionCache,
  updateSessionCache
};
