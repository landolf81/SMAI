/**
 * 탈퇴/삭제된 사용자 처리를 위한 헬퍼 함수
 */

// 기본 프로필 이미지 경로
const DEFAULT_PROFILE_PIC = '/default/default_profile.png';

/**
 * 사용자가 탈퇴했는지 확인
 * @param {Object} user - 사용자 객체
 * @returns {boolean}
 */
export const isDeletedUser = (user) => {
  if (!user) return true;
  return !!user.deleted_at;
};

/**
 * 사용자 표시 이름 반환
 * - 사용자가 없으면: "알 수 없는 사용자"
 * - 탈퇴한 사용자면: "탈퇴한 사용자"
 * - 정상 사용자면: name 또는 username
 * @param {Object} user - 사용자 객체
 * @param {string} fallback - 기본값 (선택사항)
 * @returns {string}
 */
export const getDisplayName = (user, fallback = '알 수 없는 사용자') => {
  if (!user) return fallback;
  if (user.deleted_at) return '탈퇴한 사용자';
  return user.name || user.username || fallback;
};

/**
 * 사용자 프로필 사진 URL 반환
 * - 사용자가 없거나 탈퇴했으면: 기본 프로필 이미지
 * - 정상 사용자면: profile_pic 또는 profilePic
 * @param {Object} user - 사용자 객체
 * @returns {string}
 */
export const getProfilePic = (user) => {
  if (!user || user.deleted_at) return DEFAULT_PROFILE_PIC;
  return user.profile_pic || user.profilePic || DEFAULT_PROFILE_PIC;
};

/**
 * 사용자 프로필 클릭 가능 여부
 * - 탈퇴한 사용자는 프로필 클릭 불가
 * @param {Object} user - 사용자 객체
 * @returns {boolean}
 */
export const isProfileClickable = (user) => {
  if (!user) return false;
  return !user.deleted_at;
};

/**
 * 사용자 정보를 안전하게 표시하기 위한 객체 반환
 * @param {Object} user - 사용자 객체
 * @returns {Object} 안전한 사용자 정보
 */
export const getSafeUserInfo = (user) => {
  const isDeleted = isDeletedUser(user);

  return {
    id: user?.id || null,
    name: getDisplayName(user),
    profilePic: getProfilePic(user),
    isDeleted,
    isClickable: isProfileClickable(user),
    // 탈퇴한 사용자는 민감 정보 숨김
    email: isDeleted ? null : (user?.email || null),
    bio: isDeleted ? null : (user?.bio || null),
    username: isDeleted ? null : (user?.username || null),
  };
};

/**
 * 사용자 아바타 렌더링을 위한 스타일 클래스 반환
 * @param {Object} user - 사용자 객체
 * @returns {string} 추가할 CSS 클래스
 */
export const getAvatarClassName = (user) => {
  if (!user || user.deleted_at) {
    return 'opacity-50 grayscale';
  }
  return '';
};

export default {
  isDeletedUser,
  getDisplayName,
  getProfilePic,
  isProfileClickable,
  getSafeUserInfo,
  getAvatarClassName,
};
