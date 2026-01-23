/**
 * Cloudflare Images Service
 * 이미지 업로드, 변환, 최적화
 */

import { supabase } from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';

// Cloudflare Images 계정 해시 (delivery URL에 사용)
// 형식: https://imagedelivery.net/{account_hash}/{image_id}/{variant}
const CF_IMAGES_ACCOUNT_HASH = import.meta.env.VITE_CF_IMAGES_ACCOUNT_HASH || '';

// 이미지 Variants (Cloudflare Images 대시보드에서 설정)
export const IMAGE_VARIANTS = {
  PUBLIC: 'public',      // 원본 크기 (제한 없음)
  THUMBNAIL: 'thumbnail', // 150x150 썸네일
  SMALL: 'small',        // 320px 너비
  MEDIUM: 'medium',      // 640px 너비
  LARGE: 'large',        // 1280px 너비
  AVATAR: 'avatar',      // 128x128 프로필 사진
  COVER: 'cover',        // 1200x400 커버 이미지
};

/**
 * iOS Safari 감지 (iPad on iOS 13+ 포함)
 */
const isIOSSafari = () => {
  const ua = navigator.userAgent;
  // iPhone, iPad, iPod 직접 감지
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPad on iOS 13+는 Mac으로 표시되지만 터치 지원 + 독립형 모드 체크
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !window.MSStream;
  const isIOS = isIOSDevice || isIPadOS;
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|Edg/.test(ua);
  return isIOS && isSafari;
};

/**
 * XMLHttpRequest를 사용한 업로드 (iOS Safari 폴백)
 */
const uploadWithXHR = (url, formData, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve(result);
        } catch {
          reject(new Error('응답 파싱 실패'));
        }
      } else {
        reject(new Error(`업로드 실패: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('네트워크 오류'));
    xhr.ontimeout = () => reject(new Error('업로드 시간 초과'));
    xhr.timeout = 120000; // 2분

    xhr.send(formData);
  });
};

/**
 * Cloudflare Images에 이미지 업로드
 * @param {File} file - 업로드할 이미지 파일
 * @param {Object} options - 옵션
 * @param {Function} options.onProgress - 진행률 콜백
 * @param {Object} options.metadata - 메타데이터
 * @returns {Promise<{id: string, url: string, variants: Object}>}
 */
export const uploadImageToCloudflare = async (file, options = {}) => {
  const { onProgress, metadata = {} } = options;

  try {
    // 1. Edge Function에서 Direct Upload URL 요청
    const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-image', {
      body: {
        requireSignedURLs: false,
        metadata: {
          ...metadata,
          originalName: file.name,
          size: file.size,
          type: file.type,
        },
      },
    });

    if (uploadError || !uploadData?.uploadURL) {
      throw new Error(uploadError?.message || 'Upload URL 생성 실패');
    }

    const { uploadURL, id } = uploadData;

    // 2. 이미지 파일 업로드 (파일명 UUID로 변경)
    const ext = file.name.split('.').pop() || 'jpg';
    const randomFileName = `${uuidv4()}.${ext}`;
    const renamedFile = new File([file], randomFileName, { type: file.type });

    const formData = new FormData();
    formData.append('file', renamedFile);

    let result;
    if (isIOSSafari()) {
      console.log('📱 iOS Safari 감지 - XHR 업로드 사용');
      result = await uploadWithXHR(uploadURL, formData, onProgress);
    } else {
      const response = await fetch(uploadURL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`업로드 실패: ${response.status}`);
      }

      result = await response.json();
    }

    if (!result.success) {
      throw new Error(result.errors?.[0]?.message || '이미지 업로드 실패');
    }

    // 3. 결과 반환
    const imageId = result.result.id;

    return {
      id: imageId,
      url: getImageUrl(imageId), // 기본 public variant
      variants: {
        public: getImageUrl(imageId, IMAGE_VARIANTS.PUBLIC),
        thumbnail: getImageUrl(imageId, IMAGE_VARIANTS.THUMBNAIL),
        small: getImageUrl(imageId, IMAGE_VARIANTS.SMALL),
        medium: getImageUrl(imageId, IMAGE_VARIANTS.MEDIUM),
        large: getImageUrl(imageId, IMAGE_VARIANTS.LARGE),
        avatar: getImageUrl(imageId, IMAGE_VARIANTS.AVATAR),
        cover: getImageUrl(imageId, IMAGE_VARIANTS.COVER),
      },
      originalFilename: file.name,
    };
  } catch (error) {
    console.error('❌ Cloudflare Images 업로드 실패:', error);
    throw error;
  }
};

/**
 * 여러 이미지를 Cloudflare Images에 업로드
 * @param {File[]} files - 업로드할 파일 배열
 * @param {Object} options - 옵션
 * @returns {Promise<Array>}
 */
export const uploadMultipleImages = async (files, options = {}) => {
  const results = [];
  const { onProgress } = options;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const result = await uploadImageToCloudflare(file, {
      ...options,
      onProgress: onProgress ? (progress) => {
        // 전체 진행률 계산
        const overallProgress = Math.round(((i + progress / 100) / files.length) * 100);
        onProgress(overallProgress);
      } : undefined,
    });
    results.push(result);
  }

  return results;
};

/**
 * Cloudflare Images URL 생성
 * @param {string} imageId - 이미지 ID
 * @param {string} variant - variant 이름 (기본: public)
 * @returns {string} 이미지 URL
 */
export const getImageUrl = (imageId, variant = IMAGE_VARIANTS.PUBLIC) => {
  if (!imageId) return '';
  if (!CF_IMAGES_ACCOUNT_HASH) {
    return '';
  }
  return `https://imagedelivery.net/${CF_IMAGES_ACCOUNT_HASH}/${imageId}/${variant}`;
};

/**
 * URL이 Cloudflare Images URL인지 확인
 * @param {string} url
 * @returns {boolean}
 */
export const isCloudflareImagesUrl = (url) => {
  if (!url) return false;
  return url.includes('imagedelivery.net');
};

/**
 * Cloudflare Images URL에서 이미지 ID 추출
 * @param {string} url
 * @returns {string|null}
 */
export const extractImageId = (url) => {
  if (!isCloudflareImagesUrl(url)) return null;

  // URL 형식: https://imagedelivery.net/{account_hash}/{image_id}/{variant}
  const parts = url.split('/');
  if (parts.length >= 5) {
    return parts[4]; // image_id
  }
  return null;
};

/**
 * 기존 이미지 URL을 다른 variant로 변환
 * @param {string} url - 기존 Cloudflare Images URL
 * @param {string} variant - 새 variant
 * @returns {string}
 */
export const changeVariant = (url, variant) => {
  if (!isCloudflareImagesUrl(url)) return url;

  const imageId = extractImageId(url);
  if (!imageId) return url;

  return getImageUrl(imageId, variant);
};

/**
 * Cloudflare Images에서 이미지 삭제
 * @param {string} imageId - 삭제할 이미지 ID
 * @returns {Promise<boolean>} 성공 여부
 */
export const deleteImage = async (imageId) => {
  if (!imageId) {
    console.warn('삭제할 이미지 ID가 없습니다.');
    return false;
  }

  try {
    console.log('🗑️ Cloudflare Images 삭제 요청:', imageId);

    const { data, error } = await supabase.functions.invoke('delete-image', {
      body: { imageId }
    });

    if (error) {
      console.error('이미지 삭제 Edge Function 오류:', error);
      return false;
    }

    if (data?.success) {
      console.log('✅ Cloudflare Images 삭제 완료:', imageId);
      return true;
    } else {
      console.warn('⚠️ 이미지 삭제 실패:', data?.error || '알 수 없는 오류');
      return false;
    }
  } catch (error) {
    console.error('❌ 이미지 삭제 중 오류:', error);
    return false;
  }
};

/**
 * URL에서 이미지 ID를 추출하여 삭제
 * @param {string} url - Cloudflare Images URL
 * @returns {Promise<boolean>} 성공 여부
 */
export const deleteImageByUrl = async (url) => {
  const imageId = extractImageId(url);
  if (!imageId) {
    console.warn('URL에서 이미지 ID를 추출할 수 없습니다:', url);
    return false;
  }
  return deleteImage(imageId);
};

// 서비스 객체
export const cfImagesService = {
  upload: uploadImageToCloudflare,
  uploadMultiple: uploadMultipleImages,
  getUrl: getImageUrl,
  isCloudflareImagesUrl,
  extractImageId,
  changeVariant,
  delete: deleteImage,
  deleteByUrl: deleteImageByUrl,
  VARIANTS: IMAGE_VARIANTS,
};

export default cfImagesService;
