/**
 * AdPollCard.jsx
 * 역할: 광고 카드 내 투표 표시 + 투표 인터랙션 + 결과 프로그레스바
 * 상태:
 *   - 투표 전: 선택지를 탭 가능한 버튼으로 표시
 *   - 투표 후: 가로 프로그레스바 + 퍼센트 + 투표수
 *   - 마감/만료: 결과만 표시 + "투표 마감" 뱃지
 * PollCard.jsx (광장용) 기반, 광고 테마(오렌지/앰버) 적용
 */
import React, { useState, useCallback, useMemo } from 'react';

// ── 아이콘 SVG ──
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
  </svg>
);

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
    <path fillRule="evenodd" d="M8 1a3.5 3.5 0 00-3.5 3.5V7H4a2 2 0 00-2 2v4a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2h-.5V4.5A3.5 3.5 0 008 1zm2 6V4.5a2 2 0 10-4 0V7h4z" clipRule="evenodd" />
  </svg>
);

/**
 * @param {Object} props
 * @param {Object} props.poll - ad_polls 데이터 (ad_poll_options 포함)
 * @param {string[]} props.myVotes - 현재 유저가 투표한 option_id 배열
 * @param {Function} props.onVote - (pollId, optionId) => void
 * @param {string|null} props.currentUserId
 * @param {boolean} props.isVoting - 투표 처리 중 여부
 */
const AdPollCard = ({ poll, myVotes = [], onVote, currentUserId, isVoting = false }) => {
  const [selectedForVote, setSelectedForVote] = useState(null);

  // 정렬된 선택지
  const sortedOptions = useMemo(() => {
    if (!poll?.ad_poll_options) return [];
    return [...poll.ad_poll_options].sort((a, b) => a.sort_order - b.sort_order);
  }, [poll?.ad_poll_options]);

  // 만료 체크
  const isExpired = poll?.expires_at ? new Date(poll.expires_at) < new Date() : false;
  const isClosed = poll?.is_closed || isExpired;
  const hasVoted = myVotes.length > 0;
  const showResults = hasVoted || isClosed;
  const totalVotes = poll?.total_votes || 0;

  // 남은 시간 표시
  const remainingText = useMemo(() => {
    if (!poll?.expires_at || isClosed) return null;
    const diff = new Date(poll.expires_at) - new Date();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) return `${Math.floor(hours / 24)}일 남음`;
    if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
    return `${minutes}분 남음`;
  }, [poll?.expires_at, isClosed]);

  // 투표 핸들러 (비로그인도 session_id로 투표 가능)
  const handleVote = useCallback((optionId) => {
    if (isClosed || isVoting) return;
    setSelectedForVote(optionId);
    onVote?.(poll.id, optionId);
  }, [isClosed, isVoting, onVote, poll?.id]);

  if (!poll || !sortedOptions.length) return null;

  return (
    <div className="mt-3 mb-3 bg-white rounded-xl border border-orange-200 overflow-hidden shadow-sm">
      {/* 질문 헤더 */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-[15px] font-bold text-gray-900 leading-snug">
          📊 {poll.question}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {poll.is_multiple && (
            <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-medium">복수선택</span>
          )}
          {poll.is_anonymous && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-medium">
              <LockIcon /> 익명
            </span>
          )}
          {remainingText && (
            <span className="text-[10px] text-orange-500 font-medium">⏱ {remainingText}</span>
          )}
          {isClosed && (
            <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-bold">투표 마감</span>
          )}
        </div>
      </div>

      {/* 선택지 목록 */}
      <div className="px-3 pb-2 space-y-1.5">
        {sortedOptions.map((option) => {
          const isMyVote = myVotes.includes(option.id);
          const percentage = totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0;
          const isSelected = selectedForVote === option.id;

          if (showResults) {
            // ── 결과 표시 모드 ──
            return (
              <div
                key={option.id}
                className={`relative rounded-lg overflow-hidden cursor-pointer transition-all ${
                  !isClosed ? 'active:scale-[0.98]' : ''
                }`}
                onClick={() => !isClosed && handleVote(option.id)}
              >
                <div className="absolute inset-0 bg-gray-100 rounded-lg" />
                <div
                  className={`absolute inset-y-0 left-0 rounded-lg transition-all duration-500 ${
                    isMyVote ? 'bg-orange-200/70' : 'bg-gray-200/60'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isMyVote && (
                      <span className="text-orange-500 flex-shrink-0"><CheckIcon /></span>
                    )}
                    <span className={`text-[14px] truncate ${isMyVote ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                      {option.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <span className="text-[12px] text-gray-500">{option.vote_count}표</span>
                    <span className={`text-[13px] font-bold ${isMyVote ? 'text-orange-600' : 'text-gray-600'}`}>
                      {percentage}%
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          // ── 투표 전 모드 (버튼) ──
          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={isVoting}
              className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all duration-200 ${
                isSelected
                  ? 'border-orange-400 bg-orange-50 scale-[0.98]'
                  : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/30 active:scale-[0.98]'
              } disabled:opacity-50`}
            >
              <span className="text-[14px] text-gray-800">{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* 푸터 */}
      <div className="px-4 py-2 bg-orange-50/50 border-t border-orange-100 flex items-center justify-between">
        <span className="text-[12px] text-gray-500">
          {totalVotes}명 참여
        </span>
        {hasVoted && !isClosed && (
          <span className="text-[11px] text-gray-400">탭하여 변경</span>
        )}
      </div>
    </div>
  );
};

export default React.memo(AdPollCard);
