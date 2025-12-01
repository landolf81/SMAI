/**
 * 링크 감지 및 처리 유틸리티
 */

// URL 정규식 - 다양한 URL 형태를 포괄적으로 감지
const URL_REGEX = /(https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&=\/]*))/g;

// YouTube URL 정규식 - 다양한 YouTube URL 형태 지원
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

/**
 * 텍스트에서 모든 URL을 감지
 * @param {string} text - 분석할 텍스트
 * @returns {Array} URL 목록
 */
export const detectLinks = (text) => {
  if (!text || typeof text !== 'string') return [];
  
  const matches = text.match(URL_REGEX);
  return matches || [];
};

/**
 * URL의 유형을 판단
 * @param {string} url - 분석할 URL
 * @returns {string} 링크 유형
 */
export const getLinkType = (url) => {
  if (!url) return 'unknown';
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'youtube';
  }
  if (lowerUrl.includes('instagram.com')) {
    return 'instagram';
  }
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
    return 'twitter';
  }
  if (lowerUrl.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (lowerUrl.includes('facebook.com')) {
    return 'facebook';
  }
  
  return 'generic';
};

/**
 * YouTube URL에서 비디오 ID 추출
 * @param {string} url - YouTube URL
 * @returns {string|null} 비디오 ID 또는 null
 */
export const getYouTubeVideoId = (url) => {
  if (!url) return null;
  
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
};

/**
 * YouTube 비디오 ID로 썸네일 URL 생성
 * @param {string} videoId - YouTube 비디오 ID
 * @param {string} quality - 썸네일 품질 ('default', 'hqdefault', 'maxresdefault')
 * @returns {string} 썸네일 URL
 */
export const getYouTubeThumbnail = (videoId, quality = 'hqdefault') => {
  if (!videoId) return '';
  
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
};

/**
 * YouTube 임베드 URL 생성
 * @param {string} videoId - YouTube 비디오 ID
 * @param {Object} options - 임베드 옵션
 * @returns {string} 임베드 URL
 */
export const getYouTubeEmbedUrl = (videoId, options = {}) => {
  if (!videoId) return '';
  
  const params = new URLSearchParams({
    autoplay: options.autoplay ? '1' : '0',
    mute: options.mute ? '1' : '0',
    controls: options.controls !== false ? '1' : '0',
    rel: options.showRelated !== false ? '1' : '0',
    modestbranding: '1', // YouTube 로고 최소화
  });
  
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

/**
 * 텍스트에서 첫 번째 링크의 정보 추출
 * @param {string} text - 분석할 텍스트
 * @returns {Object|null} 링크 정보 객체 또는 null
 */
export const getFirstLinkInfo = (text) => {
  const links = detectLinks(text);
  if (links.length === 0) return null;
  
  const firstLink = links[0];
  const linkType = getLinkType(firstLink);
  
  const linkInfo = {
    url: firstLink,
    type: linkType,
    originalText: text
  };
  
  if (linkType === 'youtube') {
    const videoId = getYouTubeVideoId(firstLink);
    if (videoId) {
      linkInfo.videoId = videoId;
      linkInfo.thumbnailUrl = getYouTubeThumbnail(videoId);
      linkInfo.embedUrl = getYouTubeEmbedUrl(videoId, { 
        autoplay: false, 
        mute: true,
        controls: true
      });
    }
  }
  
  return linkInfo;
};

/**
 * URL이 유효한지 검증
 * @param {string} url - 검증할 URL
 * @returns {boolean} 유효성 여부
 */
export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 도메인명 추출
 * @param {string} url - URL
 * @returns {string} 도메인명
 */
export const getDomainName = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
};

export default {
  detectLinks,
  getLinkType,
  getYouTubeVideoId,
  getYouTubeThumbnail,
  getYouTubeEmbedUrl,
  getFirstLinkInfo,
  isValidUrl,
  getDomainName
};