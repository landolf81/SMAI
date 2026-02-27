/**
 * 탈퇴/삭제된 사용자 처리를 위한 헬퍼 함수
 */

// 기본 프로필 이미지 경로 (탈퇴한 사용자용)
const DEFAULT_PROFILE_PIC = '/default/default_profile.png';

/** 배경색 20가지 (파스텔톤) */
const BG_COLORS = [
  'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf',
  'a3e4d7', 'f9e79f', 'fadbd8', 'd5dbdb', 'aed6f1',
  'f5cba7', 'abebc6', 'd2b4de', 'f9e79f', 'a9cce3',
  'f0b27a', 'a2d9ce', 'e8daef', 'fdebd0', 'a9dfbf',
];

/** 형태(몸) 색상 12가지 */
const SHAPE_COLORS = [
  '0a5b83', '1c799f', '69d2e7', 'f38181', 'fce38a',
  '95e1d3', 'aa96da', 'fcbad3', 'a8d8ea', 'ff6f61',
  '6b5b95', '88b04b',
];

/** 눈 색상 10가지 */
const EYE_COLORS = [
  '000000', '3b3a30', '5b4a3f', '2c3e50', '1a1a2e',
  '4a4e69', '6d4c41', '37474f', '263238', '3e2723',
];

/** 입 색상 8가지 */
const MOUTH_COLORS = [
  'd35400', 'e74c3c', 'c0392b', 'ff6b6b', 'e17055',
  'b71c1c', 'ff8a80', 'ef5350',
];

/** 그라디언트 각도 6가지 */
const BG_ROTATIONS = [0, 60, 120, 180, 240, 300];

/** 문자열 → 정수 해시 (djb2 변형) */
function hashSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * DiceBear API를 사용하여 사용자별 고유 아바타 URL 생성
 * thumbs 스타일 고정, 해시 기반으로 배경색·형태색·배경타입 다양화
 * @param {string} seed - 아바타 생성에 사용할 시드 (보통 user.id)
 * @returns {string} DiceBear 아바타 URL
 */
export const generateDiceBearAvatar = (seed) => {
  const h = hashSeed(seed);
  const bg = BG_COLORS[h % BG_COLORS.length];
  const shape = SHAPE_COLORS[(h >> 4) % SHAPE_COLORS.length];
  const eyes = EYE_COLORS[(h >> 8) % EYE_COLORS.length];
  const mouth = MOUTH_COLORS[(h >> 12) % MOUTH_COLORS.length];
  const isGradient = (h >> 16) % 3 === 0;
  const bgType = isGradient ? 'gradientLinear' : 'solid';
  const rotation = isGradient ? BG_ROTATIONS[(h >> 18) % BG_ROTATIONS.length] : 0;

  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`
    + `&backgroundColor=${bg}&backgroundType=${bgType}`
    + `&shapeColor=${shape}&eyesColor=${eyes}&mouthColor=${mouth}`
    + (isGradient ? `&backgroundRotation=${rotation}` : '');
};

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
 * - 프로필 사진이 없으면: DiceBear로 생성된 아바타
 * @param {Object} user - 사용자 객체
 * @returns {string}
 */
export const getProfilePic = (user) => {
  if (!user || user.deleted_at) return DEFAULT_PROFILE_PIC;

  const profilePic = user.profile_pic || user.profilePic;

  // 프로필 사진이 있으면 사용
  if (profilePic) {
    // 이미 전체 URL이거나 /uploads/로 시작하면 그대로 반환
    if (profilePic.startsWith('http') || profilePic.startsWith('/uploads/')) {
      return profilePic;
    }
    // 상대 경로면 /uploads/profiles/ 접두사 추가
    return `/uploads/profiles/${profilePic}`;
  }

  // 프로필 사진이 없으면 DiceBear 아바타 생성
  // userId/user_id는 댓글/게시물에서 사용하는 실제 사용자 ID
  // user.id는 사용자 객체의 ID (하지만 댓글의 경우 comment.id가 될 수 있음)
  // UUID 형식(36자)인지 확인하여 올바른 사용자 ID를 seed로 사용
  const isUUID = (str) => typeof str === 'string' && str.length === 36 && str.includes('-');

  // 우선순위: userId/user_id (항상 사용자 ID) > UUID 형식의 id > username > name
  const seed = user.userId || user.user_id ||
               (isUUID(user.id) ? user.id : null) ||
               user.username || user.name || 'default';
  return generateDiceBearAvatar(seed);
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
  generateDiceBearAvatar,
};
