import axios from 'axios'
import { API_URL } from './config/api';

// 동적으로 API URL 설정
const getApiUrl = () => {
    return `${API_URL}/`;
};

// 커스텀 axios 인스턴스 - baseURL을 매번 계산
const createRequest = (config = {}) => {
    const currentApiUrl = getApiUrl();
    
    // Creating request with baseURL: ${currentApiUrl}
    
    return axios({
        ...config,
        baseURL: currentApiUrl,
        withCredentials: true,
        headers: {
            ...config.headers,
            ...(localStorage.getItem('token') && {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            })
        }
    });
};

// 에러 처리를 위한 응답 래퍼
const handleResponse = async (requestPromise) => {
    try {
        const response = await requestPromise;
        // Response: ${response.status}
        return response;
    } catch (error) {
        console.error('API Error:', error.message);
        
        // axios 에러와 fetch 에러 모두 처리
        const status = error.response?.status || error.status;
        const statusText = error.response?.statusText || error.statusText;
        
        // Error Details: ${status} ${statusText}
        
        if (status === 401 || status === 403) {
            // 인증 오류 발생, 토큰 제거
            localStorage.removeItem('token');
        }
        
        // 에러 객체 표준화
        const standardError = new Error(error.message || 'Network Error');
        standardError.response = error.response || {
            status: status,
            statusText: statusText,
            data: error.data || error.message
        };
        
        throw standardError;
    }
};

// makeRequest 객체 - 매번 새로운 요청 생성 및 응답 처리
export const makeRequest = {
    get: (url, config = {}) => handleResponse(createRequest({ method: 'GET', url, ...config })),
    post: (url, data, config = {}) => handleResponse(createRequest({ method: 'POST', url, data, ...config })),
    put: (url, data, config = {}) => handleResponse(createRequest({ method: 'PUT', url, data, ...config })),
    delete: (url, config = {}) => handleResponse(createRequest({ method: 'DELETE', url, ...config })),
    patch: (url, data, config = {}) => handleResponse(createRequest({ method: 'PATCH', url, data, ...config }))
};