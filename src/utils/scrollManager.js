/**
 * 게시판별 스크롤 위치 관리 유틸리티
 */

const SCROLL_STORAGE_KEY = 'meridian_scroll_positions';

class ScrollManager {
  constructor() {
    this.scrollPositions = this.loadScrollPositions();

    // 새로고침 감지: performance.navigation 또는 PerformanceNavigationTiming 사용
    this.clearOnReload();
  }

  // 새로고침 시 스크롤 위치 초기화
  clearOnReload() {
    try {
      // Modern API (PerformanceNavigationTiming)
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0 && navEntries[0].type === 'reload') {
        console.log('[스크롤] 새로고침 감지 - 스크롤 위치 초기화');
        this.clearAllScrollPositions();
        return;
      }

      // Legacy API fallback
      if (performance.navigation && performance.navigation.type === 1) {
        console.log('[스크롤] 새로고침 감지 (legacy) - 스크롤 위치 초기화');
        this.clearAllScrollPositions();
      }
    } catch (error) {
      // 새로고침 감지 실패 시 무시
    }
  }

  // 로컬 스토리지에서 스크롤 위치 불러오기
  loadScrollPositions() {
    try {
      const saved = localStorage.getItem(SCROLL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      // 스크롤 위치 로드 실패
      return {};
    }
  }

  // 로컬 스토리지에 스크롤 위치 저장
  saveScrollPositions() {
    try {
      localStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(this.scrollPositions));
    } catch (error) {
      // 스크롤 위치 저장 실패
    }
  }

  // 게시판별 고유 키 생성
  generateKey(path, tag = null, search = null, userId = null) {
    let key = path;
    if (tag) key += `_tag_${tag}`;
    if (search) key += `_search_${search}`;
    if (userId) key += `_user_${userId}`;
    return key;
  }

  // 스크롤 위치 저장
  saveScrollPosition(path, scrollTop, tag = null, search = null, userId = null) {
    const key = this.generateKey(path, tag, search, userId);
    this.scrollPositions[key] = {
      scrollTop,
      timestamp: Date.now()
    };
    this.saveScrollPositions();
    console.log(`[스크롤] 저장: ${key} = ${scrollTop}px (현재 window.scrollY: ${window.scrollY})`);
  }

  // 스크롤 위치 복원
  restoreScrollPosition(path, tag = null, search = null, userId = null) {
    const key = this.generateKey(path, tag, search, userId);
    const saved = this.scrollPositions[key];

    if (saved) {
      // 5분 이내의 스크롤 위치만 복원 (너무 오래된 것은 무시)
      const MAX_AGE = 5 * 60 * 1000; // 5분
      if (Date.now() - saved.timestamp < MAX_AGE) {
        console.log(`[스크롤] 복원 요청: ${key} = ${saved.scrollTop}px`);
        return saved.scrollTop;
      } else {
        // 오래된 위치 삭제
        console.log(`[스크롤] 만료됨: ${key} (${Math.round((Date.now() - saved.timestamp) / 1000)}초 경과)`);
        delete this.scrollPositions[key];
        this.saveScrollPositions();
      }
    } else {
      console.log(`[스크롤] 저장된 위치 없음: ${key}`);
    }

    return 0; // 기본값은 맨 위
  }

  // 특정 게시판의 스크롤 위치 삭제
  clearScrollPosition(path, tag = null, search = null, userId = null) {
    const key = this.generateKey(path, tag, search, userId);
    delete this.scrollPositions[key];
    this.saveScrollPositions();
  }

  // 모든 스크롤 위치 삭제
  clearAllScrollPositions() {
    this.scrollPositions = {};
    this.saveScrollPositions();
  }

  // 현재 저장된 스크롤 위치 목록 확인 (디버깅용)
  getStoredPositions() {
    return { ...this.scrollPositions };
  }
}

export const scrollManager = new ScrollManager();
export default scrollManager;