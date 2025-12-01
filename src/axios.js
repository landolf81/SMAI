import axios from 'axios';
import { API_URL } from './config/api';

// API 기본 설정
export const makeRequest = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 요청 인터셉터
makeRequest.interceptors.request.use(
    (config) => {
        // 토큰이 있으면 헤더에 추가
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        // FormData인 경우 Content-Type을 자동으로 설정하도록 제거
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 응답 인터셉터
makeRequest.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            // 특정 API는 401이어도 자동 로그아웃하지 않음
            const url = error.config?.url;
            if (url && url.includes('/pin')) {
                // 고정하기 API는 권한 부족으로 401이 날 수 있으므로 자동 로그아웃하지 않음
                return Promise.reject(error);
            }
            
            // 일반적인 401은 로그인 페이지로 이동
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default makeRequest;
