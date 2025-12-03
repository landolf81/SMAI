import { supabase } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import { API_BASE_URL } from '../config/api.js';
import { uploadToR2, uploadMultipleToR2, deleteFromR2, isR2Url } from './r2Service.js';

/**
 * Storage 서비스
 * Cloudflare R2를 기본으로 사용 (Supabase Storage는 레거시 지원)
 */

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
   * 파일 업로드 (R2 우선 사용)
   * @param {string} bucket - 버킷/폴더 이름
   * @param {string} filePath - 저장할 경로 (R2에서는 폴더로 사용)
   * @param {File} file - 파일 객체
   * @param {Object} options - 업로드 옵션
   * @returns {Promise<Object>} 업로드 결과 (url, path)
   */
  async uploadFile(bucket, filePath, file, options = {}) {
    try {
      // R2로 업로드
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
   * 여러 파일 업로드 (R2 우선 사용)
   * @param {string} bucket - 버킷 이름
   * @param {string} folderPath - 폴더 경로
   * @param {File[]} files - 파일 배열
   * @param {Object} options - 업로드 옵션
   * @returns {Promise<Array>} 업로드 결과 배열
   */
  async uploadFiles(bucket, folderPath, files, options = {}) {
    try {
      // R2로 업로드
      if (USE_R2) {
        const results = await uploadMultipleToR2(files, bucket);
        return results.map(result => ({
          success: true,
          path: result.key,
          url: result.url,
          fullPath: result.key
        }));
      }

      // Supabase Storage (폴백)
      const uploadPromises = files.map((file) => {
        const ext = file.name.split('.').pop();
        const filename = `${uuidv4()}.${ext}`;
        const filePath = `${folderPath}/${filename}`;
        return this.uploadFile(bucket, filePath, file, options);
      });

      const results = await Promise.all(uploadPromises);
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
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadAvatar(file, type = 'profile') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

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
   * 광고 이미지 업로드
   * @param {string} adId - 광고 ID
   * @param {File} file - 파일 객체
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadAdImage(adId, file) {
    try {
      const ext = file.name.split('.').pop();
      const filename = `${uuidv4()}.${ext}`;
      const filePath = `${adId}/${filename}`;

      return await this.uploadFile(BUCKETS.ADS, filePath, file, {
        upsert: true
      });
    } catch (error) {
      console.error('광고 이미지 업로드 오류:', error);
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
      const { data: { user } } = await supabase.auth.getUser();
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
      // SVG 기본 아바타 (인라인 Data URI) - 무한 루프 방지
      return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"%3E%3Ccircle cx="16" cy="16" r="16" fill="%23e5e7eb"/%3E%3Cpath d="M16 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 10c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" fill="%239ca3af"/%3E%3C/svg%3E';
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
  }
};

export default storageService;
