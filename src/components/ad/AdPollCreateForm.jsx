/**
 * AdPollCreateForm.jsx
 * 역할: 관리자 광고 생성/수정 폼 내 투표 설정 섹션
 * - 질문 입력 (100자), 선택지 2~8개 (각 50자)
 * - 익명/복수선택 토글, 기간 선택
 * - controlled 컴포넌트: 부모(AdminAdsNew)가 state 관리
 * - 오렌지/앰버 테마 (관리자 패널 일관성)
 */
import React, { useCallback } from 'react';

const DURATION_OPTIONS = [
  { label: '무기한', value: null },
  { label: '1일', value: 24 },
  { label: '3일', value: 72 },
  { label: '7일', value: 168 },
  { label: '30일', value: 720 },
];

const MAX_OPTIONS = 8;
const MIN_OPTIONS = 2;

/**
 * @param {Object} props
 * @param {Object} props.pollData - { question, options, isAnonymous, isMultiple, expiresInHours }
 * @param {Function} props.onChange - (pollData) => void
 * @param {Function} props.onRemove - () => void (투표 제거)
 */
const AdPollCreateForm = ({ pollData, onChange, onRemove }) => {
  const { question = '', options = ['', ''], isAnonymous = false, isMultiple = false, expiresInHours = null } = pollData || {};

  // 필드 업데이트 헬퍼
  const update = useCallback((field, value) => {
    onChange({ ...pollData, [field]: value });
  }, [pollData, onChange]);

  // 선택지 변경
  const handleOptionChange = useCallback((idx, value) => {
    const next = [...options];
    next[idx] = value;
    update('options', next);
  }, [options, update]);

  // 선택지 추가
  const addOption = useCallback(() => {
    if (options.length >= MAX_OPTIONS) return;
    update('options', [...options, '']);
  }, [options, update]);

  // 선택지 삭제
  const removeOption = useCallback((idx) => {
    if (options.length <= MIN_OPTIONS) return;
    update('options', options.filter((_, i) => i !== idx));
  }, [options, update]);

  return (
    <div className="space-y-4 bg-amber-50/50 border border-amber-200 rounded-xl p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="text-sm font-bold text-gray-800">광고 투표 설정</span>
        </div>
        <button
          onClick={onRemove}
          className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
        >
          투표 제거
        </button>
      </div>

      {/* 질문 입력 */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">질문</label>
        <input
          type="text"
          value={question}
          onChange={(e) => update('question', e.target.value)}
          placeholder="사용자에게 무엇을 물어볼까요?"
          maxLength={100}
          className="w-full px-3 py-2.5 border-2 border-amber-300 rounded-xl text-sm text-gray-800 placeholder-gray-400 bg-white outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
        />
        <div className="text-right text-[11px] text-gray-400 mt-0.5">{question.length}/100</div>
      </div>

      {/* 선택지 입력 */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">선택지</label>
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-5 text-center flex-shrink-0">{idx + 1}</span>
              <input
                type="text"
                value={opt}
                onChange={(e) => handleOptionChange(idx, e.target.value)}
                placeholder={`선택지 ${idx + 1}`}
                maxLength={50}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-300 bg-white outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-200 transition-all"
              />
              {options.length > MIN_OPTIONS && (
                <button
                  onClick={() => removeOption(idx)}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
                  aria-label="선택지 삭제"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < MAX_OPTIONS && (
          <button
            onClick={addOption}
            className="mt-2 w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-400 font-medium hover:border-amber-300 hover:text-amber-600 transition-colors"
          >
            + 선택지 추가
          </button>
        )}
      </div>

      {/* 옵션 토글 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-700">복수 선택 허용</span>
          <input
            type="checkbox"
            checked={isMultiple}
            onChange={(e) => update('isMultiple', e.target.checked)}
            className="toggle toggle-sm toggle-warning"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-700">익명 투표</span>
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => update('isAnonymous', e.target.checked)}
            className="toggle toggle-sm toggle-warning"
          />
        </div>
      </div>

      {/* 만료 시간 */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">투표 기간</label>
        <div className="flex flex-wrap gap-1.5">
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d.label}
              onClick={() => update('expiresInHours', d.value)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                expiresInHours === d.value
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(AdPollCreateForm);
