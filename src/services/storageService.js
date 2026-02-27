import { supabase } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import { API_BASE_URL } from '../config/api.js';
import { uploadToR2, uploadMultipleToR2, deleteFromR2, isR2Url } from './r2Service.js';
import { uploadVideo } from './videoUploadService.js';
import { uploadImageToCloudflare, uploadMultipleImages, isCloudflareImagesUrl, getImageUrl, IMAGE_VARIANTS, deleteImageByUrl } from './cfImagesService.js';
import { generateDiceBearAvatar } from '../utils/userHelper.js';

/**
 * Storage 서비스
 * - 이미지: Cloudflare Images (자동 최적화, CDN)
 * - 동영상: Cloudflare Stream
 * - 기타 파일: Cloudflare R2 (레거시 폴백)
 */

// Cloudflare Images 사용 여부 (true: CF Images, false: R2)
const USE_CF_IMAGES = import.meta.env.VITE_CF_IMAGES_ACCOUNT_HASH ? true : false;

// 버킷 이름 상수 (R2 폴더명으로도 사용)
export const BUCKETS = {
  AVATARS: 'avatars',
  POSTS: 'posts',
  ADS: 'ads',
  DM_ATTACHMENTS: 'dm-attachments',
  BADGES: 'badges',
  TRADES: 'trades'
};

// R2 사용 여부 (항상 R2 사용)
const USE_R2 = true;

export const storageService = {
  /**
   * 파일 업로드 (이미지: CF Images, 기타: R2)
   * @param {string} bucket - 버킷/폴더 이름
   * @param {string} filePath - 저장할 경로 (R2에서는 폴더로 사용)
   * @param {File} file - 파일 객체
   * @param {Object} options - 업로드 옵션
   * @returns {Promise<Object>} 업로드 결과 (url, path)
   */
  async uploadFile(bucket, filePath, file, options = {}) {
    try {
      // 이미지 파일이고 CF Images가 활성화된 경우
      if (USE_CF_IMAGES && file.type.startsWith('image/')) {
        const result = await uploadImageToCloudflare(file, {
          metadata: { bucket, originalPath: filePath },
          onProgress: options.onProgress
        });
        return {
          success: true,
          path: result.id,
          url: result.url,
          fullPath: result.id,
          type: 'cloudflare-images',
          variants: result.variants
        };
      }

      // R2로 업로드 (이미지가 아니거나 CF Images 비활성화)
      if (USE_R2) {
        const result = await uploadToR2(file, bucket);
        return {
          success: true,
          path: result.key,
          url: result.url,
          fullPath: result.key
        };
      }

      // Supabase Storage (폴백)
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          contentType: options.contentType || file.type,
          cacheControl: options.cacheControl || '3600',
          upsert: options.upsert || false
        });

      if (error) throw error;

      // Public URL 생성
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return {
        success: true,
        path: data.path,
        url: urlData.publicUrl,
        fullPath: data.fullPath
      };
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      throw error;
    }
  },

  /**
   * 여러 파일 업로드 (이미지: CF Images, 기타: R2)
   * @param {string} bucket - 버킷 이름
   * @param {string} folderPath - 폴더 경로
   * @param {File[]} files - 파일 배열
   * @param {Object} options - 업로드 옵션
   * @returns {Promise<Array>} 업로드 결과 배열
   */
  async uploadFiles(bucket, folderPath, files, options = {}) {
    try {
      // 이미지 파일들만 분리
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      const otherFiles = files.filter(f => !f.type.startsWith('image/'));

      const results = [];

      // 이미지 파일: Cloudflare Images로 업로드
      if (USE_CF_IMAGES && imageFiles.length > 0) {
        const cfResults = await uploadMultipleImages(imageFiles, {
          metadata: { bucket, folderPath },
          onProgress: options.onProgress
        });
        cfResults.forEach(result => {
          results.push({
            success: true,
            path: result.id,
            url: result.url,
            fullPath: result.id,
            type: 'cloudflare-images',
            variants: result.variants
          });
        });
      } else if (imageFiles.length > 0) {
        // CF Images 비활성화시 R2로
        const r2Results = await uploadMultipleToR2(imageFiles, bucket);
        r2Results.forEach(result => {
          results.push({
            success: true,
            path: result.key,
            url: result.url,
            fullPath: result.key
          });
        });
      }

      // 기타 파일: R2로 업로드
      if (otherFiles.length > 0) {
        if (USE_R2) {
          const r2Results = await uploadMultipleToR2(otherFiles, bucket);
          r2Results.forEach(result => {
            results.push({
              success: true,
              path: result.key,
              url: result.url,
              fullPath: result.key
            });
          });
        } else {
          // Supabase Storage (폴백)
          for (const file of otherFiles) {
            const ext = file.name.split('.').pop();
            const filename = `${uuidv4()}.${ext}`;
            const filePath = `${folderPath}/${filename}`;
            const result = await this.uploadFile(bucket, filePath, file, options);
            results.push(result);
          }
        }
      }

      return results;
    } catch (error) {
      console.error('여러 파일 업로드 오류:', error);
      throw error;
    }
  },

  /**
   * 파일 삭제 (R2 또는 Supabase)
   * @param {string} bucket - 버킷 이름
   * @param {string} filePath - 파일 경로 또는 R2 키
   * @param {string} url - 원본 URL (R2 여부 판단용)
   * @returns {Promise<boolean>} 성공 여부
   */
  async deleteFile(bucket, filePath, url = null) {
    try {
      // R2 URL인 경우 R2에서 삭제
      if (url && isR2Url(url)) {
        await deleteFromR2(filePath);
        return true;
      }

      // Supabase Storage에서 삭제
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('파일 삭제 오류:', error);
      throw error;
    }
  },

  /**
   * 여러 파일 삭제
   * @param {string} bucket - 버킷 이름
   * @param {string[]} filePaths - 파일 경로 배열
   * @returns {Promise<boolean>} 성공 여부
   */
  async deleteFiles(bucket, filePaths) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove(filePaths);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('여러 파일 삭제 오류:', error);
      throw error;
    }
  },

  /**
   * Public URL 가져오기
   * @param {string} bucket - 버킷 이름
   * @param {string} filePath - 파일 경로
   * @returns {string} Public URL
   */
  getPublicUrl(bucket, filePath) {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  /**
   * 이미지 변환 URL 생성 (리사이징, 썸네일)
   * @param {string} bucket - 버킷 이름
   * @param {string} filePath - 파일 경로
   * @param {Object} transform - 변환 옵션 (width, height, quality, format)
   * @returns {string} 변환된 이미지 URL
   */
  getTransformedImageUrl(bucket, filePath, transform = {}) {
    const { width, height, quality = 80, format = 'webp' } = transform;

    const baseUrl = this.getPublicUrl(bucket, filePath);
    const transformParams = [];

    if (width) transformParams.push(`width=${width}`);
    if (height) transformParams.push(`height=${height}`);
    if (quality) transformParams.push(`quality=${quality}`);
    if (format) transformParams.push(`format=${format}`);

    if (transformParams.length === 0) return baseUrl;

    return `${baseUrl}?${transformParams.join('&')}`;
  },

  /**
   * 프로필 사진 업로드
   * @param {File} file - 파일 객체
   * @param {string} type - 'profile' 또는 'cover'
   * @param {string} oldImageUrl - 기존 이미지 URL (삭제용)
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadAvatar(file, type = 'profile', oldImageUrl = null) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 기존 이미지가 Cloudflare Images URL이면 삭제
      if (oldImageUrl && isCloudflareImagesUrl(oldImageUrl)) {
        console.log(`🗑️ 기존 ${type} 이미지 삭제 시도:`, oldImageUrl);
        await deleteImageByUrl(oldImageUrl);
      }

      const ext = file.name.split('.').pop();
      const filename = `${type}.${ext}`;
      const filePath = `${user.id}/${filename}`;

      return await this.uploadFile(BUCKETS.AVATARS, filePath, file, {
        upsert: true // 기존 파일 덮어쓰기
      });
    } catch (error) {
      console.error('프로필 사진 업로드 오류:', error);
      throw error;
    }
  },

  /**
   * 프로필/커버 이미지 삭제 (이미지만 삭제, DB 업데이트 X)
   * @param {string} imageUrl - 삭제할 이미지 URL
   * @returns {Promise<boolean>} 성공 여부
   */
  async deleteAvatarImage(imageUrl) {
    try {
      if (!imageUrl) {
        console.warn('삭제할 이미지 URL이 없습니다.');
        return false;
      }

      // Cloudflare Images URL인 경우
      if (isCloudflareImagesUrl(imageUrl)) {
        console.log('🗑️ Cloudflare Images에서 삭제:', imageUrl);
        return await deleteImageByUrl(imageUrl);
      }

      // R2 URL인 경우
      if (isR2Url(imageUrl)) {
        console.log('🗑️ R2에서 삭제:', imageUrl);
        // R2 키 추출 및 삭제
        const urlParts = imageUrl.split('/');
        const key = urlParts.slice(-2).join('/'); // userId/filename
        await deleteFromR2(key);
        return true;
      }

      console.warn('알 수 없는 이미지 URL 형식:', imageUrl);
      return false;
    } catch (error) {
      console.error('프로필 이미지 삭제 오류:', error);
      return false;
    }
  },

  /**
   * 게시물 이미지 업로드
   * @param {string} postId - 게시물 ID
   * @param {File} file - 파일 객체
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadPostImage(postId, file) {
    try {
      const ext = file.name.split('.').pop();
      const filename = `${uuidv4()}.${ext}`;
      const filePath = `${postId}/${filename}`;

      return await this.uploadFile(BUCKETS.POSTS, filePath, file);
    } catch (error) {
      console.error('게시물 이미지 업로드 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 여러 이미지 업로드
   * @param {string} postId - 게시물 ID
   * @param {File[]} files - 파일 배열
   * @returns {Promise<Array>} 업로드 결과 배열
   */
  async uploadPostImages(postId, files) {
    try {
      return await this.uploadFiles(BUCKETS.POSTS, postId, files);
    } catch (error) {
      console.error('게시물 여러 이미지 업로드 오류:', error);
      throw error;
    }
  },

  /**
   * 광고 미디어 업로드 (이미지는 R2, 동영상은 Cloudflare Stream)
   * @param {string} adId - 광고 ID
   * @param {File} file - 파일 객체
   * @param {Function} onProgress - 진행률 콜백 (동영상 업로드 시)
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadAdImage(adId, file, onProgress = null) {
    try {
      // 동영상인 경우 Cloudflare Stream으로 업로드
      if (file.type.startsWith('video/')) {
        const result = await uploadVideo(file, onProgress);
        return {
          success: true,
          url: result.iframeUrl,
          path: result.uid,
          fullPath: result.uid,
          type: 'stream',
          uid: result.uid,
          thumbnailUrl: result.thumbnailUrl,
          playbackUrl: result.playbackUrl
        };
      }

      // 이미지는 기존대로 R2로 업로드
      const ext = file.name.split('.').pop();
      const filename = `${uuidv4()}.${ext}`;
      const filePath = `${adId}/${filename}`;

      return await this.uploadFile(BUCKETS.ADS, filePath, file, {
        upsert: true
      });
    } catch (error) {
      console.error('광고 미디어 업로드 오류:', error);
      throw error;
    }
  },

  /**
   * DM 첨부파일 업로드
   * @param {string} messageId - 메시지 ID
   * @param {File} file - 파일 객체
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadDMAttachment(messageId, file) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const ext = file.name.split('.').pop();
      const filename = `${uuidv4()}.${ext}`;
      const filePath = `${user.id}/${messageId}/${filename}`;

      return await this.uploadFile(BUCKETS.DM_ATTACHMENTS, filePath, file);
    } catch (error) {
      console.error('DM 첨부파일 업로드 오류:', error);
      throw error;
    }
  },

  /**
   * 중고거래 이미지 업로드
   * @param {string} itemId - 거래 아이템 ID
   * @param {File} file - 파일 객체
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadTradeImage(itemId, file) {
    try {
      const ext = file.name.split('.').pop();
      const filename = `${uuidv4()}.${ext}`;
      const filePath = `${itemId}/${filename}`;

      return await this.uploadFile(BUCKETS.TRADES, filePath, file);
    } catch (error) {
      console.error('중고거래 이미지 업로드 오류:', error);
      throw error;
    }
  },

  /**
   * 중고거래 여러 이미지 업로드
   * @param {string} itemId - 거래 아이템 ID
   * @param {File[]} files - 파일 배열
   * @returns {Promise<Array>} 업로드 결과 배열
   */
  async uploadTradeImages(itemId, files) {
    try {
      return await this.uploadFiles(BUCKETS.TRADES, itemId, files);
    } catch (error) {
      console.error('중고거래 여러 이미지 업로드 오류:', error);
      throw error;
    }
  },

  /**
   * 배지 아이콘 업로드
   * @param {string} badgeType - 배지 타입
   * @param {File} file - 파일 객체
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadBadgeIcon(badgeType, file) {
    try {
      // 한글/특수문자를 영문으로 변환 (Supabase Storage는 ASCII만 지원)
      const sanitizedType = badgeType
        .replace(/[^a-zA-Z0-9_-]/g, '_')  // 영문/숫자/언더스코어/하이픈만 허용
        .replace(/_+/g, '_')  // 연속 언더스코어 제거
        .replace(/^_|_$/g, '');  // 앞뒤 언더스코어 제거

      // 타입이 비어있으면 타임스탬프 사용
      const folderName = sanitizedType || `badge_${Date.now()}`;
      const filename = `icon_${Date.now()}.png`;  // 항상 PNG로 저장
      const filePath = `${folderName}/${filename}`;

      return await this.uploadFile(BUCKETS.BADGES, filePath, file, {
        upsert: true
      });
    } catch (error) {
      console.error('배지 아이콘 업로드 오류:', error);
      throw error;
    }
  },

  /**
   * 프로필 이미지 URL 생성
   * @param {string} profilePic - profile_pic 필드값 (Supabase URL 또는 파일명)
   * @param {string} userId - 사용자 ID (파일명만 있을 경우 사용)
   * @returns {string} 완전한 프로필 이미지 URL
   */
  getProfileImageUrl(profilePic, userId = null) {
    if (!profilePic) {
      return generateDiceBearAvatar(userId || 'default');
    }

    // 이미 완전한 URL인 경우 (Supabase Storage URL)
    if (profilePic.startsWith('http://') || profilePic.startsWith('https://')) {
      return profilePic;
    }

    // 레거시 백엔드 경로인 경우 (마이그레이션 중)
    if (profilePic.startsWith('/uploads/')) {
      return `${API_BASE_URL}${profilePic}`;
    }

    // 파일명만 있는 경우 - Supabase Storage URL 생성
    if (userId) {
      return this.getPublicUrl(BUCKETS.AVATARS, `${userId}/profile.${profilePic.split('.').pop()}`);
    }

    // profile_pic이 전체 경로인 경우 (userId/profile.ext)
    return this.getPublicUrl(BUCKETS.AVATARS, profilePic);
  },

  /**
   * QnA 이미지 업로드
   * @param {string} questionId - 질문 ID
   * @param {File} file - 파일 객체
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadQnAImage(questionId, file) {
    try {
      const ext = file.name.split('.').pop();
      const filename = `${uuidv4()}.${ext}`;
      const filePath = `qna/${questionId}/${filename}`;

      return await this.uploadFile(BUCKETS.POSTS, filePath, file);
    } catch (error) {
      console.error('QnA 이미지 업로드 오류:', error);
      throw error;
    }
  },

  /**
   * QnA 여러 이미지 업로드
   * @param {string} questionId - 질문 ID
   * @param {File[]} files - 파일 배열
   * @returns {Promise<Array>} 업로드 결과 배열
   */
  async uploadQnAImages(questionId, files) {
    try {
      return await this.uploadFiles(BUCKETS.POSTS, `qna/${questionId}`, files);
    } catch (error) {
      console.error('QnA 여러 이미지 업로드 오류:', error);
      throw error;
    }
  },

  /**
   * Cloudflare Images URL 변환 (variant 변경)
   * @param {string} url - 이미지 URL
   * @param {string} variant - 원하는 variant (thumbnail, small, medium, large, avatar, cover)
   * @returns {string} 변환된 URL
   */
  getOptimizedImageUrl(url, variant = 'public') {
    // Cloudflare Images URL인 경우
    if (isCloudflareImagesUrl(url)) {
      // URL에서 이미지 ID 추출 후 새 variant로 URL 생성
      const parts = url.split('/');
      if (parts.length >= 5) {
        const imageId = parts[4];
        return getImageUrl(imageId, variant);
      }
    }
    // 다른 URL은 그대로 반환
    return url;
  },

  /**
   * 이미지 URL이 Cloudflare Images인지 확인
   * @param {string} url
   * @returns {boolean}
   */
  isCloudflareImagesUrl(url) {
    return isCloudflareImagesUrl(url);
  },

  // Cloudflare Images variant 상수 내보내기
  IMAGE_VARIANTS
};

export default storageService;
