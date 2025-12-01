import React, { useContext, useMemo } from 'react';
import { useAdminPermissions, useFeaturePermissions, useCanWriteToTag } from '../hooks/usePermissions';
import { PERMISSION_DENIED_CONTENT, LOGIN_REQUIRED_CONTENT } from '../utils/permissions';
import { AuthContext } from '../context/AuthContext';

/**
 * 권한 기반 접근 제어 컴포넌트
 * @param {Object} props
 * @param {ReactNode} props.children - 권한이 있을 때 렌더링할 컴포넌트
 * @param {boolean} props.requireLogin - 로그인 필요 여부
 * @param {boolean} props.requireAdmin - 관리자 권한 필요 여부
 * @param {boolean} props.requireSuperAdmin - 최고 관리자 권한 필요 여부
 * @param {Function} props.customCheck - 커스텀 권한 체크 함수
 * @param {ReactNode} props.fallback - 권한이 없을 때 표시할 컴포넌트
 * @param {boolean} props.showMessage - 기본 권한 없음 메시지 표시 여부
 */
export const PermissionGuard = ({ 
  children, 
  requireLogin = false,
  requireAdmin = false, 
  requireSuperAdmin = false,
  customCheck,
  fallback,
  showMessage = true
}) => {
  const adminPermissions = useAdminPermissions();
  const featurePermissions = useFeaturePermissions();

  // 권한 체크 메모이제이션
  const { hasPermission, denialReason } = useMemo(() => {
    let hasPermission = true;
    let denialReason = null;

    if (requireLogin && !featurePermissions.isLoggedIn) {
      hasPermission = false;
      denialReason = 'login';
    } else if (requireSuperAdmin && !adminPermissions.isSuperAdmin) {
      hasPermission = false;
      denialReason = 'super_admin';
    } else if (requireAdmin && !adminPermissions.isAdmin) {
      hasPermission = false;
      denialReason = 'admin';
    } else if (customCheck && !customCheck()) {
      hasPermission = false;
      denialReason = 'custom';
    }

    return { hasPermission, denialReason };
  }, [
    requireLogin,
    requireAdmin,
    requireSuperAdmin,
    adminPermissions.isAdmin,
    adminPermissions.isSuperAdmin,
    featurePermissions.isLoggedIn,
    customCheck
  ]);

  
  // 권한이 있으면 자식 컴포넌트 렌더링
  if (hasPermission) {
    return <>{children}</>;
  }

  // 커스텀 fallback이 있으면 사용
  if (fallback) {
    return <>{fallback}</>;
  }

  // 기본 메시지 표시하지 않으면 null 반환
  if (!showMessage) {
    return null;
  }

  // 기본 권한 없음 메시지
  const content = denialReason === 'login' ? LOGIN_REQUIRED_CONTENT : PERMISSION_DENIED_CONTENT;
  
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-center">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{content.title}</h3>
        <p className="text-gray-600 mb-4">{content.message}</p>
        {denialReason === 'login' && (
          <button 
            onClick={() => window.location.href = '/login'}
            className="btn btn-primary"
          >
            {content.action}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * 관리자 전용 컴포넌트 래퍼
 */
export const AdminOnly = ({ children, fallback, showMessage = true, customCheck }) => {
  return (
    <PermissionGuard 
      requireAdmin={true}
      fallback={fallback}
      showMessage={showMessage}
      customCheck={customCheck}
    >
      {children}
    </PermissionGuard>
  );
};

/**
 * 최고 관리자 전용 컴포넌트 래퍼
 */
export const SuperAdminOnly = ({ children, fallback, showMessage = true }) => {
  return (
    <PermissionGuard 
      requireSuperAdmin={true}
      fallback={fallback}
      showMessage={showMessage}
    >
      {children}
    </PermissionGuard>
  );
};

/**
 * 로그인 사용자 전용 컴포넌트 래퍼
 */
export const LoginRequired = ({ children, fallback, showMessage = true }) => {
  return (
    <PermissionGuard 
      requireLogin={true}
      fallback={fallback}
      showMessage={showMessage}
    >
      {children}
    </PermissionGuard>
  );
};

/**
 * 태그 작성 권한 체크 컴포넌트
 * @param {Object} props
 * @param {Object} props.tag - 태그 객체
 * @param {ReactNode} props.children - 권한이 있을 때 렌더링할 컴포넌트
 * @param {ReactNode} props.fallback - 권한이 없을 때 표시할 컴포넌트
 */
export const TagWritePermission = ({ tag, children, fallback }) => {
  const featurePermissions = useFeaturePermissions();
  const { currentUser } = useContext(AuthContext);
  const canWrite = useCanWriteToTag(tag);
  
  if (!featurePermissions.isLoggedIn) {
    return fallback || (
      <div className="text-center py-4">
        <p className="text-gray-600 mb-2">이 태그로 게시물을 작성하려면 로그인이 필요합니다.</p>
        <button 
          onClick={() => window.location.href = '/login'}
          className="btn btn-primary btn-sm"
        >
          로그인
        </button>
      </div>
    );
  }

  return (
    <PermissionGuard
      customCheck={() => canWrite}
      fallback={fallback || (
        <div className="text-center py-4">
          <p className="text-gray-600">이 태그로 게시물을 작성할 권한이 없습니다.</p>
        </div>
      )}
      showMessage={false}
    >
      {children}
    </PermissionGuard>
  );
};

/**
 * 기능별 권한 체크 컴포넌트
 * @param {Object} props
 * @param {string} props.feature - 기능 이름 ('canManageTagsFeature', 'canManageAds' 등)
 * @param {ReactNode} props.children - 권한이 있을 때 렌더링할 컴포넌트
 * @param {ReactNode} props.fallback - 권한이 없을 때 표시할 컴포넌트
 */
export const FeaturePermission = ({ feature, children, fallback }) => {
  const featurePermissions = useFeaturePermissions();
  
  const hasPermission = featurePermissions[feature];
  
  if (hasPermission) {
    return <>{children}</>;
  }
  
  return fallback || null;
};

/**
 * 조건부 렌더링을 위한 권한 체크 컴포넌트
 * @param {Object} props
 * @param {boolean} props.when - 조건
 * @param {ReactNode} props.children - 조건이 true일 때 렌더링할 컴포넌트
 * @param {ReactNode} props.otherwise - 조건이 false일 때 렌더링할 컴포넌트
 */
export const ConditionalRender = ({ when, children, otherwise = null }) => {
  return when ? <>{children}</> : <>{otherwise}</>;
};

/**
 * 권한 로딩 상태를 처리하는 컴포넌트
 * @param {Object} props
 * @param {boolean} props.loading - 로딩 상태
 * @param {ReactNode} props.children - 로딩이 끝났을 때 렌더링할 컴포넌트
 * @param {ReactNode} props.fallback - 로딩 중일 때 표시할 컴포넌트
 */
export const PermissionLoader = ({ loading, children, fallback }) => {
  if (loading) {
    return fallback || (
      <div className="flex justify-center items-center py-8">
        <div className="loading loading-spinner loading-md"></div>
      </div>
    );
  }
  
  return <>{children}</>;
};

/**
 * 에러 상태를 처리하는 권한 컴포넌트
 * @param {Object} props
 * @param {Error} props.error - 에러 객체
 * @param {ReactNode} props.children - 에러가 없을 때 렌더링할 컴포넌트
 * @param {Function} props.onRetry - 재시도 함수
 */
export const PermissionError = ({ error, children, onRetry }) => {
  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">권한 확인 실패</h3>
        <p className="text-gray-600 mb-4">{error.message || '권한을 확인하는 중 오류가 발생했습니다.'}</p>
        {onRetry && (
          <button onClick={onRetry} className="btn btn-primary">
            다시 시도
          </button>
        )}
      </div>
    );
  }
  
  return <>{children}</>;
};