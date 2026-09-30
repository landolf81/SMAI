import { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { 
  checkTagPermission, 
  getWritableTags, 
  isAdmin, 
  isSuperAdmin, 
  canManageTags,
  canAssignPermissions,
  canWriteToTag,
  getUserRole,
  ADMIN_ROLES 
} from '../utils/permissions';

/**
 * 사용자의 관리자 권한을 확인하는 훅
 * @returns {Object} { isAdmin, isSuperAdmin, canManageTags, canAssignPermissions, userRole }
 */
export const useAdminPermissions = () => {
  const { currentUser } = useContext(AuthContext);

  return {
    isAdmin: isAdmin(currentUser),
    isSuperAdmin: isSuperAdmin(currentUser),
    canManageTags: canManageTags(currentUser),
    canAssignPermissions: canAssignPermissions(currentUser),
    userRole: getUserRole(currentUser)
  };
};

/**
 * 특정 태그에 대한 권한을 확인하는 훅
 * @param {number} tagId - 태그 ID
 * @param {string} permissionType - 권한 타입 ('read', 'write', 'manage')
 * @returns {Object} { hasPermission, loading, error, checkPermission }
 */
export const useTagPermission = (tagId, permissionType = 'write') => {
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { currentUser } = useContext(AuthContext);

  const checkPermission = useCallback(async () => {
    if (!currentUser || !tagId) {
      setHasPermission(false);
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const permission = await checkTagPermission(tagId, permissionType);
      setHasPermission(permission);
      return permission;
    } catch (err) {
      setError(err.message);
      setHasPermission(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, tagId, permissionType]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return {
    hasPermission,
    loading,
    error,
    checkPermission
  };
};

/**
 * 사용자가 작성 가능한 태그 목록을 가져오는 훅
 * @returns {Object} { writableTags, loading, error, refetch }
 */
export const useWritableTags = () => {
  const [writableTags, setWritableTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useContext(AuthContext);

  const fetchWritableTags = useCallback(async () => {
    if (!currentUser) {
      setWritableTags([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tags = await getWritableTags();
      setWritableTags(tags);
    } catch (err) {
      setError(err.message);
      setWritableTags([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchWritableTags();
  }, [fetchWritableTags]);

  return {
    writableTags,
    loading,
    error,
    refetch: fetchWritableTags
  };
};

/**
 * 다중 태그에 대한 권한을 확인하는 훅
 * @param {Array} tagIds - 태그 ID 배열
 * @param {string} permissionType - 권한 타입
 * @returns {Object} { permissions, loading, error, checkPermissions }
 */
export const useMultipleTagPermissions = (tagIds = [], permissionType = 'write') => {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { currentUser } = useContext(AuthContext);

  // Equal ID lists keep the same callback even when callers create a new array.
  const tagIdsKey = JSON.stringify(tagIds);
  const stableTagIds = useMemo(() => JSON.parse(tagIdsKey), [tagIdsKey]);
  const checkPermissions = useCallback(async () => {
    if (!currentUser || stableTagIds.length === 0) {
      setPermissions({});
      return {};
    }

    setLoading(true);
    setError(null);

    try {
      const permissionPromises = stableTagIds.map(async (tagId) => {
        const hasPermission = await checkTagPermission(tagId, permissionType);
        return { tagId, hasPermission };
      });

      const results = await Promise.all(permissionPromises);
      const permissionMap = results.reduce((acc, { tagId, hasPermission }) => {
        acc[tagId] = hasPermission;
        return acc;
      }, {});

      setPermissions(permissionMap);
      return permissionMap;
    } catch (err) {
      setError(err.message);
      setPermissions({});
      return {};
    } finally {
      setLoading(false);
    }
  }, [currentUser, stableTagIds, permissionType]);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  return {
    permissions,
    loading,
    error,
    checkPermissions
  };
};

/**
 * 태그별 작성 권한을 로컬에서 빠르게 확인하는 훅 (서버 요청 없음)
 * @param {Object} tag - 태그 객체
 * @returns {boolean} 작성 가능 여부
 */
export const useCanWriteToTag = (tag) => {
  const { currentUser } = useContext(AuthContext);
  
  return canWriteToTag(tag, currentUser);
};

/**
 * 라우트 보호를 위한 권한 확인 훅
 * @param {string} requiredRole - 필요한 최소 역할
 * @returns {Object} { hasAccess, loading, user }
 */
export const useRouteProtection = (requiredRole) => {
  const { currentUser } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 사용자 정보 로딩 시뮬레이션
    const timer = setTimeout(() => {
      setLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [currentUser]);

  const userRole = getUserRole(currentUser);
  const hasAccess = userRole && (
    requiredRole === ADMIN_ROLES.CONTENT_ADMIN ? 
    [ADMIN_ROLES.CONTENT_ADMIN, ADMIN_ROLES.MARKET_ADMIN, ADMIN_ROLES.SUPER_ADMIN].includes(userRole) :
    userRole === requiredRole
  );

  return {
    hasAccess: !!hasAccess,
    loading,
    user: currentUser
  };
};

/**
 * 권한 기반 기능 가시성을 관리하는 훅
 * @returns {Object} 각종 기능별 가시성 플래그
 */
export const useFeaturePermissions = () => {
  const { currentUser } = useContext(AuthContext);
  const adminPermissions = useAdminPermissions();

  return {
    // 관리자 페이지 접근
    canAccessAdminPage: adminPermissions.isAdmin,
    
    // 태그 관리
    canManageTagsFeature: adminPermissions.canManageTags,
    
    // 사용자 권한 관리
    canManageUserPermissions: adminPermissions.canAssignPermissions,
    
    // 광고 관리
    canManageAds: adminPermissions.isAdmin,
    
    // 게시물 핀 설정
    canPinPosts: adminPermissions.isAdmin,
    
    // 게시물 삭제 (다른 사용자 것)
    canDeleteAnyPost: adminPermissions.isAdmin,
    
    // 댓글 삭제 (다른 사용자 것)
    canDeleteAnyComment: adminPermissions.isAdmin,
    
    // 시스템 설정
    canAccessSystemSettings: adminPermissions.isSuperAdmin,
    
    // 사용자 목록 조회
    canViewUserList: adminPermissions.isAdmin,
    
    // 로그인 여부
    isLoggedIn: !!currentUser
  };
};

/**
 * 에러 상태 관리를 포함한 권한 확인 훅
 * @param {Function} permissionCheck - 권한 확인 함수
 * @param {Array} dependencies - 의존성 배열
 * @returns {Object} { hasPermission, loading, error, retry }
 */
export const usePermissionWithError = (permissionCheck, dependencies = []) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const permissionCheckRef = useRef(permissionCheck);
  const previousDependenciesRef = useRef(null);

  useEffect(() => {
    permissionCheckRef.current = permissionCheck;
  }, [permissionCheck]);

  const checkPermission = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await permissionCheckRef.current();
      setHasPermission(result);
    } catch (err) {
      setError(err);
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Preserve the public dynamic dependency API with React's Object.is comparison.
  // No dependency array: compare on each commit, but request only on actual changes.
  useEffect(() => {
    const previous = previousDependenciesRef.current;
    if (previous && previous.length === dependencies.length &&
        dependencies.every((value, index) => Object.is(value, previous[index]))) return;
    previousDependenciesRef.current = [...dependencies];
    checkPermission();
  });

  return {
    hasPermission,
    loading,
    error,
    retry: checkPermission
  };
};