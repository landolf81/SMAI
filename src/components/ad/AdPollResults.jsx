/**
 * AdPollResults.jsx
 * 역할: 관리자용 광고 투표 결과 표시 (조회 전용)
 * 사용 위치: AdminAdCard.jsx 상세 모달
 * - 질문 + 상태 뱃지 (진행중/마감/만료)
 * - 각 선택지: 라벨 + 투표수 + 퍼센트 + 프로그레스 바
 * - 총 투표수
 * - 마감 버튼 (진행 중인 경우)
 */
import React, { useMemo, useState, useCallback } from 'react';
import { adPollService } from '../../services';

const AdPollResults = ({ poll, onPollClosed }) => {
  const [closing, setClosing] = useState(false);

  // 정렬된 선택지
  const sortedOptions = useMemo(() => {
    if (!poll?.ad_poll_options) return [];
    return [...poll.ad_poll_options].sort((a, b) => a.sort_order - b.sort_order);
  }, [poll?.ad_poll_options]);

  // 상태 계산
  const isExpired = poll?.expires_at ? new Date(poll.expires_at) < new Date() : false;
  const isClosed = poll?.is_closed || isExpired;
  const totalVotes = poll?.total_votes || 0;

  // 만료 시간 표시
  const expiresText = useMemo(() => {
    if (!poll?.expires_at) return '무기한';
    const d = new Date(poll.expires_at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, [poll?.expires_at]);

  // 최다 득표 옵션 찾기
  const maxVoteCount = useMemo(() => {
    if (!sortedOptions.length) return 0;
    return Math.max(...sortedOptions.map(o => o.vote_count || 0));
  }, [sortedOptions]);

  // 마감 핸들러
  const handleClose = useCallback(async () => {
    if (closing || !poll?.id) return;
    if (!window.confirm('이 투표를 마감하시겠습니까? 마감 후 되돌릴 수 없습니다.')) return;
    setClosing(true);
    try {
      await adPollService.closePoll(poll.id);
      onPollClosed?.();
    } catch (error) {
      console.error('투표 마감 실패:', error);
      alert('투표 마감에 실패했습니다.');
    } finally {
      setClosing(false);
    }
  }, [closing, poll?.id, onPollClosed]);

  if (!poll || !sortedOptions.length) return null;

  return (
    <div className="mb-4">
      <h4 className="text-md font-semibold text-base-content mb-2">📊 투표 결과</h4>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        {/* 질문 + 상태 */}
        <div className="mb-3">
          <p className="text-[15px] font-bold text-base-content leading-snug">{poll.question}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {/* 상태 뱃지 */}
            {isClosed ? (
              <span className="text-[11px] text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full font-bold">
                {isExpired ? '⏰ 만료됨' : '🔒 마감됨'}
              </span>
            ) : (
              <span className="text-[11px] text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full font-bold">
                🟢 진행중
              </span>
            )}
            {poll.is_multiple && (
              <span className="text-[10px] text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded font-medium">복수선택</span>
            )}
            {poll.is_anonymous && (
              <span className="text-[10px] text-base-content/50 bg-base-200 px-1.5 py-0.5 rounded font-medium">🔒 익명</span>
            )}
            <span className="text-[10px] text-base-content/50">기한: {expiresText}</span>
          </div>
        </div>

        {/* 선택지 결과 */}
        <div className="space-y-2">
          {sortedOptions.map((option) => {
            const percentage = totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0;
            const isTop = option.vote_count > 0 && option.vote_count === maxVoteCount;

            return (
              <div key={option.id} className="relative">
                {/* 프로그레스 바 배경 */}
                <div className="relative rounded-lg overflow-hidden bg-base-100 border border-base-300">
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                      isTop ? 'bg-amber-300/60 dark:bg-amber-600/40' : 'bg-base-300/50'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                  <div className="relative flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isTop && <span className="text-amber-600 dark:text-amber-400 text-xs flex-shrink-0">👑</span>}
                      <span className={`text-[14px] truncate ${isTop ? 'font-bold text-base-content' : 'text-base-content/70'}`}>
                        {option.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[13px] text-base-content/50 font-medium">{option.vote_count}표</span>
                      <span className={`text-[14px] font-bold min-w-[36px] text-right ${
                        isTop ? 'text-amber-700 dark:text-amber-400' : 'text-base-content/60'
                      }`}>
                        {percentage}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-amber-200 dark:border-amber-800">
          <span className="text-[13px] text-base-content/60 font-medium">
            총 <span className="font-bold text-amber-700 dark:text-amber-400">{totalVotes}</span>명 참여
          </span>
          {!isClosed && (
            <button
              onClick={handleClose}
              disabled={closing}
              className="text-[12px] text-red-500 hover:text-red-700 font-medium px-3 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              {closing ? '마감 중...' : '투표 마감'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(AdPollResults);
