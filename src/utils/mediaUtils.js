/**
 * 미디어 파일 타입 감지 및 처리 유틸리티
 */
import { API_BASE_URL } from '../config/api.js';
import { isCloudflareImagesUrl, changeVariant, IMAGE_VARIANTS } from '../services/cfImagesService';

// 지원되는 동영상 확장자
const VIDEO_EXTENSIONS = [
  '.mp4', '.mov', '.webm', '.avi', '.mkv', '.wmv', 
  '.flv', '.f4v', '.m4v', '.3gp', '.ogv'
];

// 지원되는 이미지 확장자
const IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', 
  '.bmp', '.ico', '.tiff', '.tif'
];

// 동영상 MIME 타입
const VIDEO_MIME_TYPES = [
  'video/mp4', 'video/quicktime', 'video/webm', 'video/avi',
  'video/x-msvideo', 'video/x-ms-wmv', 'video/x-flv',
  'video/3gpp', 'video/ogg'
];

// 브라우저 호환 동영상 확장자 (대부분의 브라우저에서 재생 가능)
const BROWSER_COMPATIBLE_VIDEO_EXTENSIONS = ['.mp4', '.webm'];

// 브라우저 호환 동영상 MIME 타입
const BROWSER_COMPATIBLE_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'];

// 이미지 MIME 타입
const IMAGE_MIME_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/svg+xml', 'image/bmp', 'image/x-icon',
  'image/tiff'
];

/**
 * Cloudflare Stream URL 여부를 판단
 * @param {string} url - URL
 * @returns {boolean} Cloudflare Stream URL 여부
 */
export const isCloudflareStreamUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.includes('cloudflarestream.com');
};

/**
 * R2 동영상 URL 여부를 판단
 * @param {string} url - URL
 * @returns {boolean} R2 동영상 URL 여부
 */
export const isR2VideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  // R2 URL이면서 동영상 확장자를 가진 경우
  const isR2 = url.includes('r2.dev') || url.includes('r2.cloudflarestorage.com');
  if (!isR2) return false;

  const lowercaseUrl = url.toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => lowercaseUrl.endsWith(ext));
};

/**
 * Cloudflare Stream iframe URL에서 UID 추출
 * @param {string} url - iframe URL
 * @returns {string|null} UID 또는 null
 */
export const getCloudflareStreamUid = (url) => {
  if (!isCloudflareStreamUrl(url)) return null;
  // URL 형식: https://customer-xxx.cloudflarestream.com/{uid}/iframe
  const match = url.match(/cloudflarestream\.com\/([a-zA-Z0-9]+)\//);
  return match ? match[1] : null;
};

/**
 * Cloudflare Stream 동영상의 인코딩 완료 여부 확인
 * 썸네일 URL이 있고 유효한지 확인
 * @param {string} url - Cloudflare Stream URL
 * @returns {boolean} 인코딩 완료 여부
 */
export const isStreamVideoReady = (url) => {
  if (!isCloudflareStreamUrl(url)) return true; // Stream이 아니면 ready로 간주

  const uid = getCloudflareStreamUid(url);
  if (!uid) return false;

  // UID가 있으면 기본적으로 ready로 간주 (썸네일은 동영상보다 빨리 생성됨)
  // 실제 재생 시 404가 나면 CloudflareStreamPlayer에서 처리
  return true;
};

/**
 * 게시물이 인코딩 중인 동영상을 포함하는지 확인
 * 인코딩 중인 동영상이 있는 게시물만 필터링 (이미지만 있는 게시물은 통과)
 * @param {Object} post - 게시물 객체
 * @returns {boolean} 인코딩 중인 동영상 포함 여부
 */
export const hasEncodingVideo = (post) => {
  if (!post) return false;

  // photo 필드가 없으면 동영상 없음
  if (!post.photo) return false;

  let photos = post.photo;
  if (typeof photos === 'string') {
    try {
      photos = JSON.parse(photos);
    } catch {
      photos = [photos];
    }
  }

  if (!Array.isArray(photos)) photos = [photos];

  // Cloudflare Stream URL이 있는지 확인
  const hasStreamVideo = photos.some(photo => isCloudflareStreamUrl(photo));

  // Stream 동영상이 없으면 인코딩 중이 아님 (이미지 게시물은 통과)
  if (!hasStreamVideo) return false;

  // Stream 동영상이 있는 경우:
  // 생성된 지 1분 이내이고, 동영상만 있는 게시물만 필터링
  // (이미지 + 동영상 혼합 게시물은 이미지라도 보여주기 위해 통과)
  const createdAt = new Date(post.created_at || post.createdAt);
  const now = new Date();
  const diffMinutes = (now - createdAt) / (1000 * 60);

  // 1분 이상 지났으면 인코딩 완료로 간주
  if (diffMinutes >= 1) return false;

  // 1분 이내이고, 미디어가 동영상만 있는 경우에만 필터링
  const hasImage = photos.some(photo => !isCloudflareStreamUrl(photo));
  if (hasImage) return false; // 이미지가 있으면 통과

  return true; // 동영상만 있고 1분 이내면 인코딩 중
};

/**
 * 파일명/URL로 동영상 여부를 판단
 * @param {string} filename - 파일명 또는 URL
 * @returns {boolean} 동영상 파일 여부
 */
export const isVideoFile = (filename) => {
  if (!filename || typeof filename !== 'string') return false;

  // Cloudflare Stream URL도 동영상으로 인식
  if (isCloudflareStreamUrl(filename)) return true;

  const lowercaseFilename = filename.toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => lowercaseFilename.includes(ext));
};

/**
 * 파일명/URL로 이미지 여부를 판단
 * @param {string} filename - 파일명 또는 URL
 * @returns {boolean} 이미지 파일 여부
 */
export const isImageFile = (filename) => {
  if (!filename || typeof filename !== 'string') return false;
  
  const lowercaseFilename = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lowercaseFilename.includes(ext));
};

/**
 * MIME 타입으로 동영상 여부를 판단
 * @param {string} mimeType - MIME 타입
 * @returns {boolean} 동영상 MIME 타입 여부
 */
export const isVideoMimeType = (mimeType) => {
  if (!mimeType || typeof mimeType !== 'string') return false;
  
  return VIDEO_MIME_TYPES.includes(mimeType.toLowerCase());
};

/**
 * MIME 타입으로 이미지 여부를 판단
 * @param {string} mimeType - MIME 타입
 * @returns {boolean} 이미지 MIME 타입 여부
 */
export const isImageMimeType = (mimeType) => {
  if (!mimeType || typeof mimeType !== 'string') return false;
  
  return IMAGE_MIME_TYPES.includes(mimeType.toLowerCase());
};

/**
 * 파일 객체에서 미디어 타입을 종합적으로 판단
 * @param {File|string} file - File 객체 또는 파일명/URL
 * @returns {object} { isVideo: boolean, isImage: boolean, type: 'video'|'image'|'unknown' }
 */
export const getMediaType = (file) => {
  let filename = '';
  let mimeType = '';
  
  if (typeof file === 'string') {
    filename = file;
  } else if (file && typeof file === 'object') {
    filename = file.name || '';
    mimeType = file.type || '';
  }
  
  // MIME 타입이 있으면 우선 사용
  if (mimeType) {
    if (isVideoMimeType(mimeType)) {
      return { isVideo: true, isImage: false, type: 'video' };
    }
    if (isImageMimeType(mimeType)) {
      return { isVideo: false, isImage: true, type: 'image' };
    }
  }
  
  // Cloudflare Stream URL인 경우
  if (isCloudflareStreamUrl(filename)) {
    return { isVideo: true, isImage: false, type: 'cloudflare-stream' };
  }

  // MIME 타입이 없거나 판단되지 않으면 파일명으로 판단
  if (isVideoFile(filename)) {
    return { isVideo: true, isImage: false, type: 'video' };
  }
  if (isImageFile(filename)) {
    return { isVideo: false, isImage: true, type: 'image' };
  }

  return { isVideo: false, isImage: false, type: 'unknown' };
};

/**
 * URL 정규화 함수
 * @param {string} url - 정규화할 URL 또는 파일명
 * @param {string} baseUrl - 기본 URL (기본값: localhost)
 * @param {Object} options - 옵션
 * @param {boolean} options.useFeedVariant - 피드용 최적화 variant 사용 (Cloudflare Images)
 * @returns {string} 정규화된 전체 URL
 */
export const normalizeMediaUrl = (url, baseUrl = '/uploads/posts/', options = {}) => {
  if (!url) return '';

  // 이미 완전한 URL인 경우
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Cloudflare Images URL이고 피드 최적화 옵션이 있으면 large variant 사용
    if (options.useFeedVariant && isCloudflareImagesUrl(url)) {
      return changeVariant(url, IMAGE_VARIANTS.LARGE);
    }
    return url;
  }

  // /uploads로 시작하는 경우
  if (url.startsWith('/uploads')) {
    return `${API_BASE_URL}${url}`;
  }

  // 파일명만 있는 경우 (공백이 포함된 파일명 처리)
  // 공백을 %20으로 인코딩
  const encodedUrl = url.split(' ').join('%20');
  return `${baseUrl}${encodedUrl}`;
};

/**
 * 미디어 파일 배열을 정규화하고 타입 정보 추가
 * @param {Array} mediaFiles - 미디어 파일 배열
 * @param {string} baseUrl - 기본 URL
 * @returns {Array} 정규화된 미디어 정보 배열
 */
export const processMediaFiles = (mediaFiles = [], baseUrl) => {
  if (!Array.isArray(mediaFiles)) return [];
  
  return mediaFiles.map(file => {
    const normalizedUrl = normalizeMediaUrl(file, baseUrl);
    const mediaType = getMediaType(file);
    
    return {
      url: normalizedUrl,
      originalName: file,
      ...mediaType
    };
  });
};

/**
 * 파일 확장자 추출
 * @param {string} filename - 파일명
 * @returns {string} 확장자 (점 포함, 소문자)
 */
export const getFileExtension = (filename) => {
  if (!filename || typeof filename !== 'string') return '';
  
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return '';
  
  return filename.substring(lastDotIndex).toLowerCase();
};

/**
 * 미디어 타입에 따른 아이콘 반환
 * @param {string} filename - 파일명 또는 URL
 * @returns {string} 아이콘 이모지
 */
export const getMediaIcon = (filename) => {
  if (isVideoFile(filename)) return '🎥';
  if (isImageFile(filename)) return '🖼️';
  return '📄';
};

/**
 * 브라우저에서 재생 가능한 동영상 형식인지 확인
 * @param {File|string} file - File 객체 또는 파일명
 * @returns {boolean} 브라우저 호환 여부
 */
export const isBrowserCompatibleVideo = (file) => {
  let filename = '';
  let mimeType = '';

  if (typeof file === 'string') {
    filename = file;
  } else if (file && typeof file === 'object') {
    filename = file.name || '';
    mimeType = file.type || '';
  }

  // MIME 타입으로 먼저 확인
  if (mimeType && BROWSER_COMPATIBLE_VIDEO_MIME_TYPES.includes(mimeType.toLowerCase())) {
    return true;
  }

  // 파일 확장자로 확인
  const ext = getFileExtension(filename);
  return BROWSER_COMPATIBLE_VIDEO_EXTENSIONS.includes(ext);
};

/**
 * 업로드 파일 유효성 검사 (모든 동영상 형식 허용 - 압축 시 변환됨)
 * @param {File} file - 검사할 파일
 * @returns {{ valid: boolean, message?: string }} 유효성 검사 결과
 */
export const validateUploadFile = (file) => {
  if (!file) {
    return { valid: false, message: '파일이 없습니다.' };
  }

  const mediaType = getMediaType(file);

  // 이미지 파일은 통과
  if (mediaType.isImage) {
    return { valid: true };
  }

  // 모든 동영상 파일 허용 (압축 시 WebM/MP4로 변환됨)
  if (mediaType.isVideo) {
    return { valid: true };
  }

  return { valid: false, message: `지원하지 않는 파일 형식입니다. (${file.name})` };
};

/**
 * 허용되는 파일 accept 문자열 생성
 * @returns {string} input[type=file]의 accept 속성값
 */
export const getAcceptedFileTypes = () => {
  // 모든 동영상 형식 허용 (압축 시 WebM/MP4로 변환됨)
  return 'image/*,video/*,.mp4,.webm,.mov,.avi,.mkv,.wmv,.flv,.m4v,.3gp';
};

export default {
  isVideoFile,
  isImageFile,
  isVideoMimeType,
  isImageMimeType,
  getMediaType,
  normalizeMediaUrl,
  processMediaFiles,
  getFileExtension,
  getMediaIcon,
  isBrowserCompatibleVideo,
  validateUploadFile,
  getAcceptedFileTypes,
  isCloudflareStreamUrl,
  isR2VideoUrl,
  getCloudflareStreamUid,
  isStreamVideoReady,
  hasEncodingVideo
};
