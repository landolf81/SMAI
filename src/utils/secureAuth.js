import { supabase } from '../config/supabase';

/**
 * 강화된 권한 및 세션 관리 유틸리티
 */

// 에러 타입 정의
export const AUTH_ERRORS = {
    AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    AD_MANAGEMENT_PERMISSION_DENIED: 'AD_MANAGEMENT_PERMISSION_DENIED',
    SESSION_INVALID: 'SESSION_INVALID',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
};

/**
 * API 요청 시 권한 에러 처리
 */
export const handleAuthError = (error, navigate) => {
    const errorCode = error.response?.data?.error;
    const errorMessage = error.response?.data?.message || '알 수 없는 오류가 발생했습니다.';

    switch (errorCode) {
        case AUTH_ERRORS.AUTHENTICATION_REQUIRED:
        case AUTH_ERRORS.INVALID_TOKEN:
        case AUTH_ERRORS.TOKEN_EXPIRED:
        case AUTH_ERRORS.SESSION_INVALID:
            // 로그인 필요한 경우
            showAuthErrorToast('세션이 만료되었습니다. 다시 로그인해주세요.');
            localStorage.removeItem('user'); // 로컬 스토리지 정리
            navigate('/login');
            return true;

        case AUTH_ERRORS.INSUFFICIENT_PERMISSIONS:
        case AUTH_ERRORS.AD_MANAGEMENT_PERMISSION_DENIED:
            // 권한 부족
            showAuthErrorToast('접근 권한이 없습니다.');
            navigate('/');
            return true;

        case AUTH_ERRORS.RATE_LIMIT_EXCEEDED:
            // 요청 한도 초과
            showAuthErrorToast('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
            return true;

        default:
            // 기타 에러
            if (error.response?.status === 401) {
                showAuthErrorToast('인증이 필요합니다. 다시 로그인해주세요.');
                navigate('/login');
                return true;
            } else if (error.response?.status === 403) {
                showAuthErrorToast('접근 권한이 없습니다.');
                navigate('/');
                return true;
            }
            return false;
    }
};

/**
 * 토스트 알림 표시
 */
const showAuthErrorToast = (message) => {
    // 기존 토스트 제거
    const existingToasts = document.querySelectorAll('.auth-error-toast');
    existingToasts.forEach(toast => toast.remove());

    // 새 토스트 생성
    const toast = document.createElement('div');
    toast.className = 'auth-error-toast toast toast-top toast-center z-50';
    toast.innerHTML = `
        <div class="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // 5초 후 제거
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 5000);
};

/**
 * 광고 관리 API 래퍼 - 권한 체크 포함
 */
export class SecureAdAPI {
    constructor(navigate) {
        this.navigate = navigate;
    }

    /**
     * 안전한 API 요청 래퍼
     */
    async request(requestFn, options = {}) {
        const { showSuccessMessage = false, successMessage = '작업이 완료되었습니다.' } = options;
        
        try {
            const response = await requestFn();
            
            if (showSuccessMessage) {
                showAuthErrorToast(successMessage);
            }
            
            return response;
        } catch (error) {
            console.error('API 요청 오류:', error);
            
            // 권한 관련 에러 처리
            const handled = handleAuthError(error, this.navigate);
            
            if (!handled) {
                // 권한과 관련없는 일반적인 에러
                const message = error.response?.data?.message || '작업 중 오류가 발생했습니다.';
                showAuthErrorToast(message);
            }
            
            throw error;
        }
    }

    /**
     * 광고 목록 조회
     */
    async getAds(params = {}) {
        return this.request(() => makeRequest.get('/ads', { params }));
    }

    /**
     * 광고 생성
     */
    async createAd(adData) {
        return this.request(
            () => makeRequest.post('/ads', adData),
            { showSuccessMessage: true, successMessage: '광고가 생성되었습니다.' }
        );
    }

    /**
     * 광고 수정
     */
    async updateAd(adId, adData) {
        return this.request(
            () => makeRequest.put(`/ads/${adId}`, adData),
            { showSuccessMessage: true, successMessage: '광고가 수정되었습니다.' }
        );
    }

    /**
     * 광고 삭제
     */
    async deleteAd(adId) {
        return this.request(
            () => makeRequest.delete(`/ads/${adId}`),
            { showSuccessMessage: true, successMessage: '광고가 삭제되었습니다.' }
        );
    }

    /**
     * 광고 상태 토글
     */
    async toggleAdStatus(adId) {
        return this.request(
            () => makeRequest.patch(`/ads/${adId}/toggle`),
            { showSuccessMessage: true, successMessage: '광고 상태가 변경되었습니다.' }
        );
    }

    /**
     * 광고 통계 조회
     */
    async getAdStats(params = {}) {
        return this.request(() => makeRequest.get('/ads/stats', { params }));
    }

    /**
     * 대시보드 데이터 조회
     */
    async getDashboardData() {
        return this.request(() => makeRequest.get('/ads/dashboard'));
    }

    /**
     * 성과 분석
     */
    async analyzePerformance(params = {}) {
        return this.request(() => makeRequest.get('/ads/analyze', { params }));
    }

    /**
     * 예산 상태 확인
     */
    async checkBudgetStatus() {
        return this.request(() => makeRequest.get('/ads/budget-status'));
    }

    /**
     * 알고리즘 설정 조회
     */
    async getAlgorithmSettings() {
        return this.request(() => makeRequest.get('/ads/settings'));
    }
}

/**
 * 세션 상태 확인
 */
export const checkSession = async (navigate) => {
    try {
        // 간단한 인증 확인 요청
        await makeRequest.get('/ads/dashboard');
        return true;
    } catch (error) {
        console.log('세션 확인 실패:', error);
        handleAuthError(error, navigate);
        return false;
    }
};

/**
 * 관리자 권한 확인 훅과 함께 사용할 권한 체크
 */
export const validateAdminAccess = async (navigate) => {
    try {
        // 대시보드 API 호출로 관리자 권한 확인
        await makeRequest.get('/ads/dashboard');
        return true;
    } catch (error) {
        handleAuthError(error, navigate);
        return false;
    }
};

/**
 * 컴포넌트 언마운트 시 정리 함수
 */
export const cleanup = () => {
    // 토스트 메시지 정리
    const toasts = document.querySelectorAll('.auth-error-toast');
    toasts.forEach(toast => toast.remove());
};

/**
 * 정기적인 세션 체크 (5분마다)
 */
let sessionCheckInterval = null;

export const startSessionMonitoring = (navigate) => {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }
    
    sessionCheckInterval = setInterval(async () => {
        const isValid = await checkSession(navigate);
        if (!isValid) {
            stopSessionMonitoring();
        }
    }, 5 * 60 * 1000); // 5분
};

export const stopSessionMonitoring = () => {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
    }
};
