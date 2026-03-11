/**
 * PollBadge.jsx
 * 역할: 광장 메시지 타임스탬프 옆 인라인 투표 아이콘 뱃지
 */
import React from 'react';

const PollBadge = () => (
  <span
    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none bg-purple-500 text-white ml-1 flex-shrink-0"
    title="투표"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 mr-0.5">
      <path d="M3 3a1 1 0 011-1h1a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3zM7 7a1 1 0 011-1h1a1 1 0 011 1v6a1 1 0 01-1 1H8a1 1 0 01-1-1V7zM12 5a1 1 0 00-1 1v7a1 1 0 001 1h1a1 1 0 001-1V6a1 1 0 00-1-1h-1z" />
    </svg>
    투표
  </span>
);

export default React.memo(PollBadge);
