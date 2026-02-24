// 모바일 디바이스 감지 유틸리티
export const isMobileDevice = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isMobileScreen = window.innerWidth <= 768;
  // UA가 모바일이거나, 화면 너비가 768px 이하면 모바일로 처리 (프리뷰/에뮬레이터 대응)
  return isMobileUA || isMobileScreen;
};

// 태블릿 감지
export const isTabletDevice = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isTabletUA = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);
  return isTabletUA && window.innerWidth >= 768;
};

// PC/데스크톱 감지
export const isDesktopDevice = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isNotMobile = !/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  return window.innerWidth >= 1024 && isNotMobile;
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