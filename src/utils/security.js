// 보안 강화 유틸리티
import CryptoJS from 'crypto-js';

// 입력값 검증 및 sanitization
export const inputValidator = {
  // XSS 방지를 위한 HTML 이스케이프
  escapeHtml: (text) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  },

  // SQL 인젝션 방지를 위한 입력값 검증
  validateInput: (input, type = 'text') => {
    if (!input || typeof input !== 'string') return false;

    const patterns = {
      text: /^[a-zA-Z0-9가-힣\s\-_.,!?()]{1,500}$/,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      username: /^[a-zA-Z0-9_]{3,20}$/,
      password: /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      number: /^\d+$/,
      price: /^\d+(\.\d{1,2})?$/,
      market: /^[a-zA-Z0-9가-힣\s]{1,100}$/
    };

    return patterns[type] ? patterns[type].test(input) : false;
  },

  // 파일 업로드 검증
  validateFile: (file) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      throw new Error('허용되지 않는 파일 형식입니다.');
    }

    if (file.size > maxSize) {
      throw new Error('파일 크기가 너무 큽니다. (최대 5MB)');
    }

    return true;
  },

  // URL 검증
  validateUrl: (url) => {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }
};

// 데이터 암호화/복호화 (클라이언트 사이드 민감 데이터용)
export const encryption = {
  // 데이터 암호화
  encrypt: (data, key = 'default-key') => {
    try {
      const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
      return encrypted;
    } catch (error) {
      console.error('암호화 실패:', error);
      return null;
    }
  },

  // 데이터 복호화
  decrypt: (encryptedData, key = 'default-key') => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, key);
      const decrypted = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      return decrypted;
    } catch (error) {
      console.error('복호화 실패:', error);
      return null;
    }
  }
};

// 보안 HTTP 헤더 설정
export const securityHeaders = {
  // CSP (Content Security Policy) 설정
  getCSPHeaders: () => ({
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' http://localhost:8800"
    ].join('; ')
  }),

  // 기타 보안 헤더
  getSecurityHeaders: () => ({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  })
};

// 세션 보안 관리
export const sessionSecurity = {
  // 세션 타임아웃 설정 (30분)
  SESSION_TIMEOUT: 30 * 60 * 1000,

  // 마지막 활동 시간 업데이트
  updateLastActivity: () => {
    localStorage.setItem('lastActivity', Date.now().toString());
  },

  // 세션 만료 확인
  isSessionExpired: () => {
    const lastActivity = localStorage.getItem('lastActivity');
    if (!lastActivity) return true;

    const timeDiff = Date.now() - parseInt(lastActivity);
    return timeDiff > sessionSecurity.SESSION_TIMEOUT;
  },

  // 자동 로그아웃 설정
  setupAutoLogout: (logoutCallback) => {
    setInterval(() => {
      if (sessionSecurity.isSessionExpired()) {
        logoutCallback();
      }
    }, 60 * 1000); // 1분마다 체크
  },

  // 사용자 활동 추적
  trackUserActivity: () => {
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, sessionSecurity.updateLastActivity);
    });
  }
};

// API 요청 보안
export const apiSecurity = {
  // 요청 무결성 검증을 위한 해시 생성
  generateRequestHash: (data, timestamp, secret = 'api-secret') => {
    const payload = JSON.stringify(data) + timestamp;
    return CryptoJS.HmacSHA256(payload, secret).toString();
  },

  // 요청 시간 검증 (5분 이내)
  validateRequestTime: (timestamp) => {
    const now = Date.now();
    const diff = Math.abs(now - timestamp);
    return diff < 5 * 60 * 1000; // 5분
  },

  // API 요청 보안 헤더 추가
  addSecurityHeaders: (config) => {
    const timestamp = Date.now();
    return {
      ...config,
      headers: {
        ...config.headers,
        'X-Timestamp': timestamp,
        'X-Request-ID': crypto.randomUUID(),
        'X-Client-Version': '1.0.0'
      }
    };
  }
};

// 브라우저 보안 체크
export const browserSecurity = {
  // 브라우저 지원 여부 확인
  checkBrowserSupport: () => {
    const features = {
      localStorage: !!window.localStorage,
      sessionStorage: !!window.sessionStorage,
      fetch: !!window.fetch,
      crypto: !!window.crypto,
      webgl: !!window.WebGLRenderingContext
    };

    const unsupported = Object.entries(features)
      .filter(([key, supported]) => !supported)
      .map(([key]) => key);

    return {
      supported: unsupported.length === 0,
      missing: unsupported
    };
  },

  // 개발자 도구 열림 감지 (간단한 방법)
  detectDevTools: () => {
    const threshold = 160;
    setInterval(() => {
      if (window.outerWidth - window.innerWidth > threshold || 
          window.outerHeight - window.innerHeight > threshold) {
        console.warn('개발자 도구가 열린 것 같습니다.');
        // 필요시 추가 보안 조치
      }
    }, 1000);
  },

  // 복사 방지 (선택적 적용)
  preventCopy: (enable = false) => {
    if (!enable) return;

    document.addEventListener('copy', (e) => {
      e.preventDefault();
      console.warn('복사가 제한되어 있습니다.');
    });

    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    document.addEventListener('selectstart', (e) => {
      e.preventDefault();
    });
  }
};

// 보안 초기화
export const initializeSecurity = (options = {}) => {
  const {
    enableSessionTimeout = true,
    enableDevToolsDetection = false,
    enableCopyPrevention = false,
    onSessionExpired = () => console.warn('세션이 만료되었습니다.')
  } = options;

  // 브라우저 지원 체크
  const browserSupport = browserSecurity.checkBrowserSupport();
  if (!browserSupport.supported) {
    console.warn('일부 기능이 지원되지 않을 수 있습니다:', browserSupport.missing);
  }

  // 세션 보안 설정
  if (enableSessionTimeout) {
    sessionSecurity.trackUserActivity();
    sessionSecurity.setupAutoLogout(onSessionExpired);
  }

  // 개발자 도구 감지
  if (enableDevToolsDetection) {
    browserSecurity.detectDevTools();
  }

  // 복사 방지
  if (enableCopyPrevention) {
    browserSecurity.preventCopy(true);
  }

  console.log('✅ 보안 설정이 완료되었습니다.');
};

export default {
  inputValidator,
  encryption,
  securityHeaders,
  sessionSecurity,
  apiSecurity,
  browserSecurity,
  initializeSecurity
};
