import { userService } from '../services';

// 권한 레벨 상수
export const PERMISSION_LEVELS = {
  PUBLIC: 'public',
  MEMBER: 'member',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

// 관리자 역할 상수
export const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',
  MARKET_ADMIN: 'market_admin',
  CONTENT_ADMIN: 'content_admin',
  ADVERTISER: 'advertiser'
};

// 권한 타입 상수
export const PERMISSION_TYPES = {
  READ: 'read',
  WRITE: 'write',
  MANAGE: 'manage'
};

/**
 * 사용자의 특정 태그에 대한 권한 확인
 * @param {number} tagId - 태그 ID
 * @param {string} permissionType - 권한 타입 ('read', 'write', 'manage')
 * @returns {Promise<boolean>} 권한 여부
 */
export const checkTagPermission = async (tagId, permissionType = 'write') => {
  try {
    return await userService.checkTagPermission(tagId, permissionType);
  } catch (error) {
    console.error('태그 권한 확인 실패:', error);
    return false;
  }
};

/**
 * 사용자가 작성 가능한 태그 목록 조회
 * @returns {Promise<Array>} 작성 가능한 태그 목록
 */
export const getWritableTags = async () => {
  try {
    return await userService.getWritableTags();
  } catch (error) {
    console.error('작성 가능한 태그 조회 실패:', error);
    return [];
  }
};

/**
 * 현재 로그인한 사용자의 권한 정보 조회
 * @returns {Promise<Object>} 사용자 권한 정보 객체
 */
export const getCurrentUserPermissions = async () => {
  try {
    return await userService.getCurrentUserPermissions();
  } catch (error) {
    console.error('사용자 권한 정보 조회 실패:', error);
    return null;
  }
};

/**
 * 사용자의 관리자 역할 확인
 * @param {Object} user - 사용자 객체 (백엔드에서 권한 정보가 포함된 객체)
 * @returns {string|null} 관리자 역할 또는 null
 */
export const getUserRole = (user) => {
  // 백엔드에서 가져온 role 정보 사용
  return user?.role || null;
};

/**
 * 특정 역할 이상의 권한이 있는지 확인
 * @param {Object} user - 사용자 객체
 * @param {string} requiredRole - 필요한 최소 역할
 * @returns {boolean} 권한 여부
 */
export const hasRole = (user, requiredRole) => {
  const userRole = getUserRole(user);
  if (!userRole) return false;

  const roleHierarchy = {
    [ADMIN_ROLES.ADVERTISER]: 1,
    [ADMIN_ROLES.CONTENT_ADMIN]: 2,
    [ADMIN_ROLES.MARKET_ADMIN]: 3,
    [ADMIN_ROLES.SUPER_ADMIN]: 4
  };

  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
};

/**
 * 관리자 권한이 있는지 확인
 * @param {Object} user - 사용자 객체
 * @returns {boolean} 관리자 권한 여부
 */
export const isAdmin = (user) => {
  const userRole = getUserRole(user);
  // 기본 'admin' role과 계층적 role 모두 지원
  return userRole === 'admin' || hasRole(user, ADMIN_ROLES.CONTENT_ADMIN);
};

/**
 * 최고 관리자 권한이 있는지 확인
 * @param {Object} user - 사용자 객체
 * @returns {boolean} 최고 관리자 권한 여부
 */
export const isSuperAdmin = (user) => {
  return hasRole(user, ADMIN_ROLES.SUPER_ADMIN);
};

/**
 * 태그 관리 권한이 있는지 확인
 * @param {Object} user - 사용자 객체
 * @returns {boolean} 태그 관리 권한 여부
 */
export const canManageTags = (user) => {
  return hasRole(user, ADMIN_ROLES.CONTENT_ADMIN);
};

/**
 * 사용자 권한 부여 권한이 있는지 확인
 * @param {Object} user - 사용자 객체
 * @returns {boolean} 권한 부여 권한 여부
 */
export const canAssignPermissions = (user) => {
  return hasRole(user, ADMIN_ROLES.SUPER_ADMIN);
};

/**
 * 태그 권한 레벨에 따른 작성 가능 여부 확인
 * @param {Object} tag - 태그 객체
 * @param {Object} user - 사용자 객체
 * @returns {boolean} 작성 가능 여부
 */
export const canWriteToTag = (tag, user) => {
  if (!tag || !user) return false;

  const userRole = getUserRole(user);

  switch (tag.permission_level) {
    case PERMISSION_LEVELS.PUBLIC:
      return true;
    case PERMISSION_LEVELS.MEMBER:
      return !!user; // 로그인한 사용자
    case PERMISSION_LEVELS.ADMIN:
      return hasRole(user, ADMIN_ROLES.CONTENT_ADMIN);
    case PERMISSION_LEVELS.SUPER_ADMIN:
      return hasRole(user, ADMIN_ROLES.SUPER_ADMIN);
    default:
      return false;
  }
};

/**
 * 권한 에러 메시지 생성
 * @param {string} action - 수행하려는 동작
 * @param {string} requiredRole - 필요한 역할
 * @returns {string} 에러 메시지
 */
export const getPermissionErrorMessage = (action, requiredRole) => {
  const roleNames = {
    [ADMIN_ROLES.CONTENT_ADMIN]: '관리자',
    [ADMIN_ROLES.MARKET_ADMIN]: '시장 관리자',
    [ADMIN_ROLES.SUPER_ADMIN]: '최고 관리자'
  };

  const roleName = roleNames[requiredRole] || '관리자';
  return `이 작업을 수행하려면 ${roleName} 권한이 필요합니다.`;
};

/**
 * 권한 없음 상태의 기본 컴포넌트 데이터
 */
export const PERMISSION_DENIED_CONTENT = {
  title: '접근 권한 없음',
  message: '이 기능에 접근할 권한이 없습니다.',
  action: '관리자에게 문의하세요.'
};

/**
 * 로그인 필요 상태의 기본 컴포넌트 데이터
 */
export const LOGIN_REQUIRED_CONTENT = {
  title: '로그인 필요',
  message: '이 기능을 사용하려면 로그인이 필요합니다.',
  action: '로그인 페이지로 이동'
};