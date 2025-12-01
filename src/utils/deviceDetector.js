// 모바일 디바이스 감지 유틸리티
export const isMobileDevice = () => {
  // User-Agent 기반 감지
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  
  // 화면 크기 기반 감지 (768px 이하를 모바일로 간주)
  const isMobileScreen = window.innerWidth <= 768;
  
  // 터치 지원 여부
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // 종합 판단: User-Agent 또는 (작은 화면 + 터치 지원)
  return isMobileUA || (isMobileScreen && isTouchDevice);
};

// 태블릿 감지
export const isTabletDevice = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /ipad|android(?!.*mobile)|tablet/i.test(userAgent) && window.innerWidth >= 768;
};

// PC/데스크톱 감지
export const isDesktopDevice = () => {
  // 화면 크기가 1024px 이상이면 데스크톱으로 간주
  const isLargeScreen = window.innerWidth >= 1024;
  
  // User-Agent에서 명확한 모바일 디바이스가 아니면 데스크톱으로 간주
  const userAgent = navigator.userAgent.toLowerCase();
  const isNotMobile = !/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  
  return isLargeScreen || isNotMobile;
};

// 관리자용 PC 접근인지 확인 (경로 기반)
export const isAdminAccess = () => {
  return window.location.pathname.startsWith('/admin');
};

// 광고 표시 여부 결정 (모바일에서만 표시, 관리 페이지 제외)
export const shouldShowAds = () => {
  // 로그 제거하고 단순하게 처리
  return !isAdminAccess(); // 임시로 관리 페이지가 아니면 모두 허용
};