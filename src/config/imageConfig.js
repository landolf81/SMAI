/**
 * 이미지 URL 설정
 *
 * Supabase 마이그레이션 후에는 백엔드 서버(8801)에 의존하지 않고
 * 프론트엔드에서 직접 이미지를 제공합니다.
 */

// 기본 프로필 이미지
export const DEFAULT_PROFILE_IMAGE = "/default/default_profile.png";

// 기본 커버 이미지
export const DEFAULT_COVER_IMAGE = "/default/default_cover.jpg";

/**
 * 프로필 이미지 URL 생성
 * @param {string} profilePic - 프로필 이미지 파일명
 * @returns {string} 완전한 이미지 URL
 */
export const getProfileImageUrl = (profilePic) => {
  if (!profilePic || profilePic === 'defaultAvatar.png' || profilePic === 'null') {
    return DEFAULT_PROFILE_IMAGE;
  }

  // Supabase Storage URL 또는 외부 URL인 경우 그대로 반환
  if (profilePic.startsWith('http://') || profilePic.startsWith('https://')) {
    return profilePic;
  }

  // 로컬 파일인 경우 public/uploads/profiles/ 경로
  return `/uploads/profiles/${profilePic}`;
};

/**
 * 게시물 이미지 URL 생성
 * @param {string} image - 이미지 파일명
 * @returns {string} 완전한 이미지 URL
 */
export const getPostImageUrl = (image) => {
  if (!image) return null;

  // Supabase Storage URL 또는 외부 URL인 경우 그대로 반환
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }

  // 로컬 파일인 경우 public/uploads/posts/ 경로
  return `/uploads/posts/${image}`;
};

/**
 * 커버 이미지 URL 생성
 * @param {string} coverPic - 커버 이미지 파일명
 * @returns {string} 완전한 이미지 URL
 */
export const getCoverImageUrl = (coverPic) => {
  if (!coverPic || coverPic === 'null') {
    return DEFAULT_COVER_IMAGE;
  }

  // Supabase Storage URL 또는 외부 URL인 경우 그대로 반환
  if (coverPic.startsWith('http://') || coverPic.startsWith('https://')) {
    return coverPic;
  }

  // 로컬 파일인 경우 public/uploads/covers/ 경로
  return `/uploads/covers/${coverPic}`;
};

/**
 * 광고 이미지 URL 생성
 * @param {string} image - 광고 이미지 파일명
 * @returns {string} 완전한 이미지 URL
 */
export const getAdImageUrl = (image) => {
  if (!image) return null;

  // Supabase Storage URL 또는 외부 URL인 경우 그대로 반환
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }

  // 로컬 파일인 경우 public/uploads/ads/ 경로
  return `/uploads/ads/${image}`;
};

export default {
  DEFAULT_PROFILE_IMAGE,
  DEFAULT_COVER_IMAGE,
  getProfileImageUrl,
  getPostImageUrl,
  getCoverImageUrl,
  getAdImageUrl,
};
