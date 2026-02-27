/**
 * AI 사용자 뱃지 컴포넌트
 * 역할: 참외돌이 AI 댓글에 표시되는 인라인 AI 마커
 */

const AIBadge = () => (
  <span
    className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-bold leading-none bg-teal-100 text-teal-700 border border-teal-200 ml-1 flex-shrink-0"
    title="AI 참외돌이가 작성한 댓글입니다"
  >
    AI
  </span>
);

export default AIBadge;
