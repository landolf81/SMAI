/**
 * AI 사용자 뱃지 컴포넌트
 * 역할: 전기수 AI 댓글/광장글에 표시되는 인라인 AI 마커
 */

const AIBadge = () => (
  <span
    className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-bold leading-none bg-blue-500 text-white ml-1 flex-shrink-0"
    title="AI 전기수가 작성한 글입니다"
  >
    AI
  </span>
);

export default AIBadge;
