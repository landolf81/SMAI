import { supabase } from '../config/supabase';

/**
 * 링크 미리보기 서비스
 * Supabase Edge Function을 사용하여 웹페이지 메타데이터 가져오기
 */

const LINK_PREVIEW_FUNCTION = 'link-preview';

/**
 * URL의 미리보기 정보를 가져옵니다
 * @param {string} url - 미리보기를 가져올 URL
 * @returns {Promise<Object|null>} 미리보기 데이터
 */
export const fetchLinkPreview = async (url) => {
  try {
    if (!url) {
      throw new Error('URL is required');
    }

    // Supabase Edge Function 호출
    const { data, error } = await supabase.functions.invoke(LINK_PREVIEW_FUNCTION, {
      body: { url }
    });

    if (error) {
      console.error('링크 미리보기 에러:', error);
      return null;
    }

    return data;

  } catch (error) {
    console.error('링크 미리보기 요청 실패:', error);
    return null;
  }
};

/**
 * 링크 미리보기를 캐싱하여 가져옵니다
 * @param {string} url - 미리보기를 가져올 URL
 * @param {number} cacheTime - 캐시 유효 시간 (밀리초, 기본 1시간)
 * @returns {Promise<Object|null>} 미리보기 데이터
 */
export const fetchLinkPreviewWithCache = async (url, cacheTime = 3600000) => {
  const cacheKey = `link_preview_${url}`;

  // 캐시 확인
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();

    // 캐시가 유효하면 반환
    if (now - timestamp < cacheTime) {
      return data;
    }
  }

  // 캐시가 없거나 만료되면 새로 가져오기
  const data = await fetchLinkPreview(url);

  if (data) {
    // 캐시에 저장
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  }

  return data;
};

export default {
  fetchLinkPreview,
  fetchLinkPreviewWithCache
};
