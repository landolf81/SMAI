/**
 * textMeasure.js
 * Pretext 라이브러리를 활용한 텍스트 높이 측정 유틸리티
 * DOM reflow 없이 텍스트 블록의 높이를 사전 계산
 *
 * 사용처:
 * - 라운지: 새 메시지 삽입 시 스크롤 보정 (scrollHeight 대체)
 * - 향후: 피드 가상화, 채팅 가상화 등
 */
import { prepare, layout } from '@chenglou/pretext';

// ── 앱에서 사용하는 폰트 프리셋 ──
const FONTS = {
  // 라운지 메시지 본문: text-[16px] leading-relaxed
  loungeMessage: '16px "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif',
  // 라운지 닉네임: text-[15px] font-semibold
  loungeName: '600 15px "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif',
  // 피드 본문: text-sm (14px)
  postBody: '14px "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif',
  // 댓글: text-sm (14px)
  comment: '14px "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif',
};

// ── 라운지 메시지 높이 구성 상수 (CSS 기반) ──
const LOUNGE_LAYOUT = {
  paddingY: 8 + 8,          // py-2 = 8px * 2
  headerHeight: 22,          // 닉네임 + 시간 + 버튼 행 높이
  textMarginTop: 2,          // mt-0.5 = 2px
  textLineHeight: 25.6,      // 16px * 1.6 (leading-relaxed)
  imageHeight: 200,          // 이미지 평균 높이 (가변이지만 추정)
  videoHeight: 158,          // 280px * 9/16 비율
  pollHeight: 160,           // 투표 카드 평균 높이 (추정)
  borderBottom: 1,           // border-b
};

// ── 날짜 구분선 높이 ──
const DATE_SEPARATOR_HEIGHT = 40; // py-3(12*2) + 텍스트 16px

/**
 * 텍스트 높이 측정 (Pretext 사용)
 * @param {string} text - 측정할 텍스트
 * @param {string} fontKey - FONTS 프리셋 키
 * @param {number} containerWidth - 컨테이너 폭 (px)
 * @param {number} lineHeight - 줄 높이 (px)
 * @returns {{ height: number, lineCount: number }}
 */
export function measureTextHeight(text, fontKey, containerWidth, lineHeight) {
  if (!text || containerWidth <= 0) return { height: 0, lineCount: 0 };

  const font = FONTS[fontKey] || FONTS.loungeMessage;
  const prepared = prepare(text, font, { whiteSpace: 'pre-wrap' });
  return layout(prepared, containerWidth, lineHeight);
}

/**
 * 라운지 메시지 1개의 예상 높이 계산
 * DOM 측정 없이 메시지 내용 기반으로 높이 예측
 *
 * @param {Object} msg - 라운지 메시지 객체
 * @param {number} containerWidth - 메시지 영역 폭 (px), 기본 화면폭-프로필-패딩
 * @returns {number} 예상 높이 (px)
 */
export function estimateLoungeMessageHeight(msg, containerWidth) {
  if (!msg) return 0;

  const L = LOUNGE_LAYOUT;
  let height = L.paddingY + L.headerHeight + L.borderBottom;

  // 텍스트 본문 높이
  if (msg.content) {
    // 컨테이너 폭에서 프로필 이미지(36px) + gap(10px) + 좌우 패딩(16*2) 제외
    const textWidth = containerWidth - 36 - 10 - 32;
    const { height: textHeight } = measureTextHeight(
      msg.content,
      'loungeMessage',
      textWidth,
      L.textLineHeight
    );
    height += L.textMarginTop + textHeight;
  }

  // 이미지
  if (msg.image_url || (msg.image_urls && msg.image_urls.length > 0)) {
    height += L.imageHeight;
  }

  // 동영상
  if (msg.video_url) {
    height += L.videoHeight;
  }

  // 투표
  if (msg.lounge_polls) {
    height += L.pollHeight;
  }

  return Math.ceil(height);
}

/**
 * 라운지 날짜 구분선 높이
 * @returns {number}
 */
export function getDateSeparatorHeight() {
  return DATE_SEPARATOR_HEIGHT;
}

export { FONTS, LOUNGE_LAYOUT };
