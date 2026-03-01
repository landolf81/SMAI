/**
 * AI 사용자 설정 (전기수)
 * 역할: AI_USER_ID 상수 + isAIUser() 판별 헬퍼
 */

// 전기수 AI 사용자 UUID (Supabase Auth)
export const AI_USER_ID = '1bbaab1f-572f-4375-9bca-1cfc6a89553b';

/**
 * 주어진 사용자/댓글 객체가 AI 사용자인지 판별
 * @param {Object} userOrComment - 사용자 또는 댓글 객체
 * @returns {boolean}
 */
export const isAIUser = (userOrComment) => {
  if (!userOrComment) return false;
  const uid = userOrComment.userId || userOrComment.user_id || userOrComment.id;
  return uid === AI_USER_ID;
};
