/**
 * adSessionId.js
 * 역할: 비로그인 사용자의 광고 투표 식별용 세션 ID 관리
 * localStorage에 UUID를 저장하여 기기별 1표 유지
 * 사용 위치: adPollService.js, MobileAdDisplay.jsx
 */

const STORAGE_KEY = 'ad_poll_session_id';

/**
 * 비로그인 투표용 세션 ID 조회/생성
 * 최초 호출 시 UUID 생성 후 localStorage에 저장, 이후 동일 값 반환
 * @returns {string} UUID 형식 세션 ID
 */
export const getAdSessionId = () => {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
};
