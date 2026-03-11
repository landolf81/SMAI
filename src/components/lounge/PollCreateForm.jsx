/**
 * PollCreateForm.jsx
 * 역할: 광장 투표 생성 폼
 * - 질문 입력 (100자)
 * - 선택지 2~8개 (각 50자)
 * - 익명 투표 / 복수 선택 토글
 * - 만료 시간 설정 (무기한/1시간/6시간/24시간/3일)
 */
import React, { useState, useCallback } from 'react';

const DURATION_OPTIONS = [
  { label: '무기한', value: null },
  { label: '1시간', value: 1 },
  { label: '6시간', value: 6 },
  { label: '24시간', value: 24 },
  { label: '3일', value: 72 },
];

const MAX_OPTIONS = 8;
const MIN_OPTIONS = 2;

/**
 * @param {Object} props
 * @param {Function} props.onSubmit - ({ question, options, isAnonymous, isMultiple, expiresInHours }) => void
 * @param {Function} props.onCancel - 폼 닫기
 * @param {boolean} props.isSubmitting - 제출 중
 * @param {number} props.cooldownLeft - 쿨다운 남은 초
 */
const PollCreateForm = ({ onSubmit, onCancel, isSubmitting = false, cooldownLeft = 0 }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isMultiple, setIsMultiple] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState(null);

  // 선택지 변경
  const handleOptionChange = useCallback((idx, value) => {
    setOptions((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }, []);

  // 선택지 추가
  const addOption = useCallback(() => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, '']);
  }, [options.length]);

  // 선택지 삭제
  const removeOption = useCallback((idx) => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }, [options.length]);

  // 유효성 검사
  const isValid = question.trim().length > 0 &&
    options.filter((o) => o.trim().length > 0).length >= MIN_OPTIONS;

  // 제출
  const handleSubmit = useCallback(() => {
    if (!isValid || isSubmitting || cooldownLeft > 0) return;
    const validOptions = options.filter((o) => o.trim().length > 0);
    onSubmit({
      question: question.trim(),
      options: validOptions.map((o) => o.trim()),
      isAnonymous,
      isMultiple,
      expiresInHours,
    });
  }, [isValid, isSubmitting, cooldownLeft, question, options, isAnonymous, isMultiple, expiresInHours, onSubmit]);

  return (
    <div className="flex flex-col">
      {/* 질문 입력 */}
      <div className="px-5 pt-4 pb-2">
        <label className="text-[13px] font-semibold text-gray-600 mb-1 block">질문</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="무엇을 물어볼까요?"
          maxLength={100}
          autoFocus
          className="w-full px-3 py-2.5 border-2 border-purple-300 rounded-xl text-[15px] text-gray-800 placeholder-gray-400 bg-gray-50 outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all"
          style={{ fontSize: '16px' }}
        />
        <div className="text-right text-[11px] text-gray-400 mt-0.5">{question.length}/100</div>
      </div>

      {/* 선택지 입력 */}
      <div className="px-5 pb-2">
        <label className="text-[13px] font-semibold text-gray-600 mb-1.5 block">선택지</label>
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-[13px] text-gray-400 w-5 text-center flex-shrink-0">{idx + 1}</span>
              <input
                type="text"
                value={opt}
                onChange={(e) => handleOptionChange(idx, e.target.value)}
                placeholder={`선택지 ${idx + 1}`}
                maxLength={50}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[14px] text-gray-800 placeholder-gray-300 bg-white outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-200 transition-all"
                style={{ fontSize: '16px' }}
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
            className="mt-2 w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-[13px] text-gray-400 font-medium hover:border-purple-300 hover:text-purple-500 transition-colors"
          >
            + 선택지 추가
          </button>
        )}
      </div>

      {/* 옵션 토글 */}
      <div className="px-5 py-2 space-y-2">
        {/* 복수 선택 */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-gray-700">복수 선택 허용</span>
          <input
            type="checkbox"
            checked={isMultiple}
            onChange={(e) => setIsMultiple(e.target.checked)}
            className="toggle toggle-sm toggle-primary"
          />
        </div>
        {/* 익명 투표 */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-gray-700">익명 투표</span>
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="toggle toggle-sm toggle-primary"
          />
        </div>
      </div>

      {/* 만료 시간 */}
      <div className="px-5 py-2">
        <label className="text-[13px] font-semibold text-gray-600 mb-1.5 block">투표 기간</label>
        <div className="flex flex-wrap gap-1.5">
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d.label}
              onClick={() => setExpiresInHours(d.value)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                expiresInHours === d.value
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* 푸터 */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between mt-2">
        <button
          onClick={onCancel}
          className="text-[13px] text-gray-500 hover:text-gray-700 font-medium"
        >
          ← 일반 글쓰기
        </button>
        <div className="flex items-center gap-2">
          {cooldownLeft > 0 && (
            <span className="text-[12px] text-orange-400 font-medium">{cooldownLeft}초</span>
          )}
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting || cooldownLeft > 0}
            className="px-5 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-[14px] font-bold rounded-xl shadow-sm disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 disabled:shadow-none transition-all duration-300"
          >
            {isSubmitting ? '생성 중...' : '투표 만들기'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PollCreateForm);
