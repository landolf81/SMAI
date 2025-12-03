/**
 * Cloudflare Stream 동영상 업로드 서비스
 * - MP4/WebM: R2에 직접 업로드 (브라우저 호환)
 * - MOV/AVI 등: Cloudflare Stream 업로드 (인코딩 필요)
 */
import { supabase } from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';
import { uploadToR2 } from './r2Service';

const MAX_DURATION_SECONDS = 180; // 3분

// 브라우저에서 직접 재생 가능한 형식
const BROWSER_COMPATIBLE_TYPES = ['video/mp4', 'video/webm'];

/**
 * 랜덤 파일명 생성
 */
const generateRandomFilename = (originalFilename) => {
  const ext = originalFilename.split('.').pop()?.toLowerCase() || 'mp4';
  return `${uuidv4()}.${ext}`;
};
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// 지원되는 동영상 형식 (Cloudflare Stream이 인코딩 처리)
const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // MOV
  'video/x-m4v',
  'video/avi',
  'video/x-msvideo',
];

/**
 * 동영상 길이 확인
 */
const getVideoDuration = (file) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('동영상 메타데이터 로드 실패'));
    };

    video.src = URL.createObjectURL(file);
  });
};

/**
 * 동영상 파일 검증
 */
export const validateVideo = async (file) => {
  // 파일 크기 체크
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      message: `동영상 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB 이하만 가능합니다.`
    };
  }

  // 포맷 체크
  if (!SUPPORTED_VIDEO_TYPES.includes(file.type)) {
    return {
      valid: false,
      message: '지원하지 않는 동영상 형식입니다. MP4, WebM, MOV 형식을 사용해주세요.'
    };
  }

  // 길이 체크
  try {
    const duration = await getVideoDuration(file);
    if (duration > MAX_DURATION_SECONDS) {
      return {
        valid: false,
        message: `동영상 길이는 ${MAX_DURATION_SECONDS / 60}분 이하만 가능합니다. (현재: ${Math.ceil(duration)}초)`
      };
    }
  } catch (e) {
    console.warn('동영상 길이 확인 실패, 서버에서 검증됨:', e);
  }

  return { valid: true };
};

/**
 * Cloudflare Stream에 동영상 업로드
 * @param {File} file - 동영상 파일
 * @param {Function} onProgress - 진행률 콜백 (0-100)
 * @returns {Promise<{uid: string, playbackUrl: string, thumbnailUrl: string}>}
 */
export const uploadVideoToStream = async (file, onProgress) => {
  // 1. 검증
  const validation = await validateVideo(file);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  // 2. Edge Function에서 업로드 URL 요청
  const { data, error } = await supabase.functions.invoke('upload-video', {
    body: { maxDurationSeconds: MAX_DURATION_SECONDS },
  });

  if (error) {
    console.error('Edge Function error:', error);
    throw new Error('업로드 URL 생성 실패');
  }

  const { uploadURL, uid } = data;

  if (!uploadURL || !uid) {
    throw new Error('업로드 URL을 받지 못했습니다.');
  }

  // 3. Cloudflare에 직접 업로드 (랜덤 파일명으로 변환)
  const randomFilename = generateRandomFilename(file.name);
  const renamedFile = new File([file], randomFilename, { type: file.type });

  const formData = new FormData();
  formData.append('file', renamedFile);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve({
          uid,
          // Cloudflare Stream 재생 URL 형식
          playbackUrl: `https://customer-xi3tfx9anf8ild8c.cloudflarestream.com/${uid}/manifest/video.m3u8`,
          thumbnailUrl: `https://customer-xi3tfx9anf8ild8c.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`,
          iframeUrl: `https://customer-xi3tfx9anf8ild8c.cloudflarestream.com/${uid}/iframe`,
        });
      } else {
        reject(new Error(`업로드 실패 (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('네트워크 오류'));
    xhr.ontimeout = () => reject(new Error('업로드 시간 초과'));

    xhr.open('POST', uploadURL);
    xhr.timeout = 300000; // 5분 타임아웃
    xhr.send(formData);
  });
};

/**
 * 동영상이 Stream 업로드인지 확인
 */
export const isStreamVideo = (url) => {
  return url && url.includes('cloudflarestream.com');
};

/**
 * Stream UID에서 재생 URL 생성
 */
export const getStreamPlaybackUrl = (uid) => {
  return `https://customer-xi3tfx9anf8ild8c.cloudflarestream.com/${uid}/manifest/video.m3u8`;
};

/**
 * Stream UID에서 썸네일 URL 생성
 */
export const getStreamThumbnailUrl = (uid, options = {}) => {
  const { time = '0s', width = 640, height = 360 } = options;
  return `https://customer-xi3tfx9anf8ild8c.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg?time=${time}&width=${width}&height=${height}`;
};

/**
 * Stream UID에서 iframe URL 생성
 */
export const getStreamIframeUrl = (uid) => {
  return `https://customer-xi3tfx9anf8ild8c.cloudflarestream.com/${uid}/iframe`;
};

/**
 * 브라우저 호환 동영상 형식인지 확인
 */
export const isBrowserCompatibleVideo = (file) => {
  return BROWSER_COMPATIBLE_TYPES.includes(file.type);
};

/**
 * 통합 동영상 업로드 함수
 * - MP4/WebM → R2 직접 업로드 (비용 절감)
 * - MOV/AVI 등 → Cloudflare Stream 업로드 (인코딩)
 *
 * @param {File} file - 동영상 파일
 * @param {Function} onProgress - 진행률 콜백 (0-100)
 * @returns {Promise<{type: 'r2'|'stream', url: string, ...}>}
 */
export const uploadVideo = async (file, onProgress) => {
  // 1. 검증
  const validation = await validateVideo(file);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const isBrowserCompatible = BROWSER_COMPATIBLE_TYPES.includes(file.type);

  if (isBrowserCompatible) {
    // MP4/WebM → R2에 직접 업로드
    const result = await uploadToR2(file, 'videos');

    // 진행률 콜백 (R2는 즉시 완료로 표시)
    if (onProgress) onProgress(100);

    return {
      type: 'r2',
      url: result.url,
      key: result.key,
      // Stream 호환 필드 (null로 설정)
      uid: null,
      iframeUrl: null,
      thumbnailUrl: null,
    };
  } else {
    // MOV/AVI 등 → Cloudflare Stream에 업로드
    const result = await uploadVideoToStream(file, onProgress);
    return {
      type: 'stream',
      url: result.iframeUrl,
      uid: result.uid,
      iframeUrl: result.iframeUrl,
      thumbnailUrl: result.thumbnailUrl,
      playbackUrl: result.playbackUrl,
      key: null,
    };
  }
};

export default {
  validateVideo,
  uploadVideoToStream,
  uploadVideo,
  isStreamVideo,
  isBrowserCompatibleVideo,
  getStreamPlaybackUrl,
  getStreamThumbnailUrl,
  getStreamIframeUrl,
  MAX_DURATION_SECONDS,
  MAX_FILE_SIZE,
};
