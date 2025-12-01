/**
 * 미디어 파일 타입 감지 및 처리 유틸리티
 */
import { API_BASE_URL } from '../config/api.js';

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
 * 파일명/URL로 동영상 여부를 판단
 * @param {string} filename - 파일명 또는 URL
 * @returns {boolean} 동영상 파일 여부
 */
export const isVideoFile = (filename) => {
  if (!filename || typeof filename !== 'string') return false;
  
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
 * @returns {string} 정규화된 전체 URL
 */
export const normalizeMediaUrl = (url, baseUrl = '/uploads/posts/') => {
  if (!url) return '';
  
  // 이미 완전한 URL인 경우
  if (url.startsWith('http://') || url.startsWith('https://')) {
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
 * 업로드 파일 유효성 검사 (브라우저 호환 동영상만 허용)
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

  // 동영상 파일은 브라우저 호환 형식만 허용
  if (mediaType.isVideo) {
    if (isBrowserCompatibleVideo(file)) {
      return { valid: true };
    }
    return {
      valid: false,
      message: `동영상은 MP4, WebM 형식만 업로드 가능합니다. (${file.name})`
    };
  }

  return { valid: false, message: `지원하지 않는 파일 형식입니다. (${file.name})` };
};

/**
 * 허용되는 파일 accept 문자열 생성
 * @returns {string} input[type=file]의 accept 속성값
 */
export const getAcceptedFileTypes = () => {
  return 'image/*,video/mp4,video/webm,.mp4,.webm';
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
  getAcceptedFileTypes
};
