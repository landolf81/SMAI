// 관리자 권한 체크 및 관련 유틸리티 함수들

/**
 * 사용자가 관리자인지 확인
 * @param {Object} user - 현재 사용자 정보
 * @returns {boolean} 관리자 여부
 */
export const isAdmin = (user) => {
    if (!user) return false;

    // 환경변수에서 관리자 정보를 가져옵니다. VITE_ADMIN_IDS=1,2
    const adminIdsFromEnv = (import.meta.env.VITE_ADMIN_IDS || '').split(',').map(id => parseInt(id.trim(), 10));
    const adminEmailsFromEnv = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',');

    // 1. 관리자 ID 목록으로 체크 (임시)
    if (adminIdsFromEnv.includes(user.id)) return true;
    
    // 2. 관리자 이메일로 체크 (임시)
    if (adminEmailsFromEnv.includes(user.email)) return true;
    
    // 3. 사용자 정보에 role 필드가 있는 경우
    if (user.role === 'admin' || user.role === 'super_admin') return true;
    
    // 4. 관리자 플래그가 있는 경우
    if (user.isAdmin === true) return true;
    
    return false;
};

/**
 * 관리자 권한 레벨 확인
 * @param {Object} user - 현재 사용자 정보
 * @returns {string} 권한 레벨 ('none', 'admin', 'super_admin')
 */
export const getAdminLevel = (user) => {
    if (!isAdmin(user)) return 'none';
    
    if (user.role === 'super_admin' || user.id === 1) return 'super_admin';
    return 'admin';
};

/**
 * 특정 관리 기능에 대한 권한 확인
 * @param {Object} user - 현재 사용자 정보
 * @param {string} permission - 확인할 권한 ('ads', 'users', 'posts', 'analytics')
 * @returns {boolean} 권한 여부
 */
export const hasPermission = (user, permission) => {
    if (!isAdmin(user)) return false;
    
    const adminLevel = getAdminLevel(user);
    
    // 슈퍼 관리자는 모든 권한
    if (adminLevel === 'super_admin') return true;
    
    // 일반 관리자의 권한 매핑
    const adminPermissions = {
        'ads': true,          // 광고 관리
        'posts': true,        // 게시물 관리
        'analytics': true,    // 통계 조회
        'users': false,       // 사용자 관리는 슈퍼 관리자만
        'system': false       // 시스템 설정은 슈퍼 관리자만
    };
    
    return adminPermissions[permission] || false;
};

/**
 * 관리자 메뉴 항목 정의
 * @param {Object} user - 현재 사용자 정보
 * @returns {Array} 접근 가능한 메뉴 항목들
 */
export const getAdminMenuItems = (user) => {
    if (!isAdmin(user)) return [];
    
    const menuItems = [];
    
    // 광고 관리
    if (hasPermission(user, 'ads')) {
        menuItems.push({
            path: '/admin/ads',
            label: '광고 관리',
            icon: '📊',
            description: '광고 생성, 수정, 삭제 등 관리'
        });
    }
    
    // 게시물 관리
    if (hasPermission(user, 'posts')) {
        menuItems.push({
            path: '/admin/posts',
            label: '게시물 관리',
            icon: '📝',
            description: '커뮤니티 게시물 관리'
        });
    }
    
    // 사용자 관리 (슈퍼 관리자만)
    if (hasPermission(user, 'users')) {
        menuItems.push({
            path: '/admin/users',
            label: '사용자 관리',
            icon: '👥',
            description: '회원 정보 및 권한 관리'
        });
    }
    
    // 통계 및 분석
    if (hasPermission(user, 'analytics')) {
        menuItems.push({
            path: '/admin/analytics',
            label: '통계 분석',
            icon: '📈',
            description: '종합 통계 및 분석'
        });
    }
    
    // 시스템 설정 (슈퍼 관리자만)
    if (hasPermission(user, 'system')) {
        menuItems.push({
            path: '/admin/system',
            label: '시스템 설정',
            icon: '⚙️',
            description: '시스템 설정 및 관리'
        });
    }
    
    return menuItems;
};

/**
 * 관리자 대시보드 위젯 권한 확인
 * @param {Object} user - 현재 사용자 정보
 * @returns {Object} 위젯별 접근 권한
 */
export const getWidgetPermissions = (user) => {
    return {
        adStats: hasPermission(user, 'analytics'),
        userStats: hasPermission(user, 'users'),
        postStats: hasPermission(user, 'posts'),
        systemInfo: hasPermission(user, 'system'),
        analytics: hasPermission(user, 'analytics')
    };
};

/**
 * 관리자 알림 및 경고 확인
 * @param {Object} user - 현재 사용자 정보
 * @returns {Array} 관리자 알림 목록
 */
export const getAdminNotifications = (user) => {
    if (!isAdmin(user)) return [];
    
    // 실제로는 API에서 가져와야 하지만, 예시로 임시 데이터
    const notifications = [];
    
    if (hasPermission(user, 'ads')) {
        notifications.push({
            type: 'warning',
            title: '예산 소진 경고',
            message: '3개 광고의 예산이 80% 이상 소진되었습니다.',
            action: '/admin/ads?filter=budget_warning',
            count: 3
        });
    }
    
    return notifications;
};

export default {
    isAdmin,
    getAdminLevel,
    hasPermission,
    getAdminMenuItems,
    getWidgetPermissions,
    getAdminNotifications
};