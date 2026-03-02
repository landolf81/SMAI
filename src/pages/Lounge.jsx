/**
 * Lounge.jsx
 * 역할: 광장 - 회원들이 짧은 텍스트 글을 나누는 단체 채팅방
 * 특징:
 *   - 실시간 수신 (Supabase Realtime)
 *   - 위로 스크롤 시 이전 메시지 로드 (IntersectionObserver)
 *   - 텍스트 전용, 도배 방지 15초 쿨다운
 *   - 메시지 롱프레스 → TTS (Web Speech API, ko-KR)
 *   - 닉네임 롱프레스 → @멘션 입력창 열기
 */
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import loungeService from '../services/loungeService';
import { storageService } from '../services';
import { generateDiceBearAvatar } from '../utils/userHelper';
import SendIcon from '@mui/icons-material/Send';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AIBadge from '../components/AIBadge';
import { AI_USER_ID } from '../config/aiUser';

// ─────────────────────────────────────────────
// 시간 포맷 (오늘이면 시:분, 아니면 날짜)
// ─────────────────────────────────────────────
const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
};

// ─────────────────────────────────────────────
// 전송 금지 패턴 검사 (전화번호, 음란·폭력 단어)
// ─────────────────────────────────────────────
const PHONE_REGEX = /01[0-9][-\s.]?\d{3,4}[-\s.]?\d{4}|0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/;
const BLOCKED_WORDS = [
  // 음란
  '씹', '보지', '자지', '섹스', '야동', '음란',
  // 폭력·위협
  '죽여버', '죽여라', '살인', '폭행', '때려죽',
  // 욕설
  '씨발', '개새끼', '병신', '지랄', '미친놈', '꺼져', '닥쳐',
];
const validateMessage = (content) => {
  if (PHONE_REGEX.test(content)) return '전화번호는 광장에 남길 수 없어요.';
  for (const word of BLOCKED_WORDS) {
    if (content.includes(word)) return '부적절한 내용이 포함되어 있어요.';
  }
  return null;
};

// ─────────────────────────────────────────────
// 날짜 구분선 표시용 키
// ─────────────────────────────────────────────
const getDateKey = (dateStr) => new Date(dateStr).toISOString().split('T')[0];

const formatDateLabel = (dateKey) => {
  const date = new Date(dateKey);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return '오늘';
  if (date.toDateString() === yesterday.toDateString()) return '어제';
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
};

const LONG_PRESS_DELAY = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10;

// ─────────────────────────────────────────────
// LoungeMessage
// props: msg, currentUserId, onDelete, onTTS, onMention, isSpeaking
// ─────────────────────────────────────────────
const LoungeMessage = React.memo(({ msg, currentUserId, onDelete, onTTS, onMention, isSpeaking }) => {
  const user = msg.users || {};
  const profileUrl = storageService.getProfileImageUrl(user.profile_pic, user.id);
  const displayName = user.name || user.username || '알 수 없음';
  const isMe = msg.user_id === currentUserId;
  const isAI = msg.user_id === AI_USER_ID;

  // ── 닉네임 롱프레스 → @멘션 ──
  const nameTimerRef = useRef(null);
  const nameTouchRef = useRef({ x: 0, y: 0 });
  const nameFiredRef = useRef(false);

  const handleNameTouchStart = useCallback((e) => {
    const t = e.touches[0];
    nameTouchRef.current = { x: t.clientX, y: t.clientY };
    nameFiredRef.current = false;
    nameTimerRef.current = setTimeout(() => {
      nameFiredRef.current = true;
    }, LONG_PRESS_DELAY);
  }, []);

  const handleNameTouchMove = useCallback((e) => {
    if (nameFiredRef.current || !nameTimerRef.current) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - nameTouchRef.current.x) > LONG_PRESS_MOVE_THRESHOLD ||
        Math.abs(t.clientY - nameTouchRef.current.y) > LONG_PRESS_MOVE_THRESHOLD) {
      clearTimeout(nameTimerRef.current);
      nameTimerRef.current = null;
    }
  }, []);

  const handleNameTouchEnd = useCallback(() => {
    clearTimeout(nameTimerRef.current);
    nameTimerRef.current = null;
    if (nameFiredRef.current) {
      onMention?.(displayName);
    }
    nameFiredRef.current = false;
  }, [displayName, onMention]);

  useEffect(() => () => clearTimeout(nameTimerRef.current), []);

  return (
    <div
      className={`flex items-start gap-2.5 px-4 py-2 group border-b border-gray-100 ${
        isMe ? 'bg-orange-50 border-l-2 border-orange-400' : ''
      } ${isSpeaking ? 'bg-blue-50' : ''}`}
    >
      <img
        src={profileUrl}
        alt={displayName}
        className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = generateDiceBearAvatar(user.id || 'default');
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {/* 닉네임 — 롱프레스 시 @멘션 */}
          <span
            className="text-[15px] font-semibold text-gray-800 select-none"
            style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
            onTouchStart={handleNameTouchStart}
            onTouchMove={handleNameTouchMove}
            onTouchEnd={handleNameTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
          >
            {displayName}
          </span>
          {isAI && <AIBadge />}
          <span className="text-[12px] text-gray-400">{formatTime(msg.created_at)}</span>
          {/* TTS 버튼 */}
          <button
            onClick={() => onTTS?.(msg.content, msg.id)}
            className={`p-0.5 rounded transition-colors ${isSpeaking ? 'text-blue-500' : 'text-gray-400 active:text-blue-400'}`}
            aria-label={isSpeaking ? 'TTS 정지' : '읽어주기'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              {isSpeaking ? (
                <path d="M5.75 3a.75.75 0 00-.75.75v12.5a.75.75 0 001.5 0V3.75A.75.75 0 005.75 3zm8.5 0a.75.75 0 00-.75.75v12.5a.75.75 0 001.5 0V3.75a.75.75 0 00-.75-.75z" />
              ) : (
                <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.84z" />
              )}
            </svg>
          </button>
          {isMe && (
            <button
              onClick={() => onDelete(msg.id)}
              className="text-[11px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
            >
              삭제
            </button>
          )}
        </div>
        <p className="text-[16px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words mt-0.5">
          {msg.content}
        </p>
      </div>
    </div>
  );
});
LoungeMessage.displayName = 'LoungeMessage';

// ─────────────────────────────────────────────
// Lounge (메인 컴포넌트)
// ─────────────────────────────────────────────
const Lounge = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const [isComposing, setIsComposing] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // TTS: 현재 재생 중인 메시지 ID
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  // ref로 관리해 stale closure 없이 toggle 판단
  const speakingMsgIdRef = useRef(null);

  const scrollAreaRef = useRef(null);
  const topSentinelRef = useRef(null);
  const bottomRef = useRef(null);
  const subscriptionRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const textareaRef = useRef(null);

  // ── 하단 여부 체크 ──
  const checkIsAtBottom = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  // ── 하단으로 스크롤 ──
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // ── 도배 방지 쿨다운 카운트다운 (1초씩 감소) ──
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = setTimeout(() => setCooldownLeft(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldownLeft]);

  // ── speechSynthesis 언마운트 클린업 ──
  useEffect(() => {
    return () => {
      if (typeof speechSynthesis !== 'undefined') {
        speechSynthesis.cancel();
      }
    };
  }, []);

  // ── 초기 메시지 로드 ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loungeService.getMessages({ limit: 30 });
        if (!cancelled) {
          setMessages(data);
          setHasMore(data.length === 30);
          // 초기 로드 후 즉시 하단으로
          requestAnimationFrame(() => scrollToBottom('auto'));
        }
      } catch (e) {
        console.error('[Lounge] 메시지 로드 실패:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [scrollToBottom]);

  // ── Realtime 구독 ──
  useEffect(() => {
    subscriptionRef.current = loungeService.subscribeToNewMessages((newMsg) => {
      setMessages((prev) => {
        // 중복 방지
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // 하단에 있으면 자동 스크롤, 아니면 버튼 표시
      if (isAtBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom());
      } else {
        setShowScrollDown(true);
      }
    });

    return () => subscriptionRef.current?.unsubscribe();
  }, [scrollToBottom]);

  // ── 스크롤 이벤트: 하단 여부 추적 ──
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const onScroll = () => {
      isAtBottomRef.current = checkIsAtBottom();
      if (isAtBottomRef.current) setShowScrollDown(false);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [checkIsAtBottom]);

  // ── 위 센티넬 IntersectionObserver (이전 메시지 로드) ──
  useEffect(() => {
    if (!topSentinelRef.current) return;

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || isLoadingMore || !hasMore) return;

        const el = scrollAreaRef.current;
        const prevScrollHeight = el?.scrollHeight || 0;

        setIsLoadingMore(true);
        try {
          const oldest = messages[0]?.created_at;
          if (!oldest) return;
          const older = await loungeService.getMessages({ beforeTime: oldest, limit: 30 });
          if (older.length === 0) {
            setHasMore(false);
            return;
          }
          setMessages((prev) => [...older, ...prev]);
          setHasMore(older.length === 30);

          // 스크롤 위치 보정
          requestAnimationFrame(() => {
            if (el) {
              el.scrollTop += el.scrollHeight - prevScrollHeight;
            }
          });
        } catch (e) {
          console.error('[Lounge] 이전 메시지 로드 실패:', e);
        } finally {
          setIsLoadingMore(false);
        }
      },
      { threshold: 0 }
    );

    observer.observe(topSentinelRef.current);
    return () => observer.disconnect();
  }, [messages, isLoadingMore, hasMore]);

  // ── TTS 핸들러 ──
  // 같은 메시지를 다시 롱프레스하면 중지(토글), 다른 메시지이면 이전 것 중지 후 새로 시작
  const handleTTS = useCallback((content, msgId) => {
    if (typeof speechSynthesis === 'undefined') return;

    // 현재 재생 중인 메시지와 동일하면 → 중지(토글)
    if (speakingMsgIdRef.current === msgId) {
      speechSynthesis.cancel();
      speakingMsgIdRef.current = null;
      setSpeakingMsgId(null);
      return;
    }

    // 다른 메시지 or 아무것도 재생 안 중 → 새로 시작
    speechSynthesis.cancel(); // 이전 재생 정리

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.9;

    utterance.onstart = () => {
      speakingMsgIdRef.current = msgId;
      setSpeakingMsgId(msgId);
    };
    utterance.onend = () => {
      speakingMsgIdRef.current = null;
      setSpeakingMsgId(null);
    };
    utterance.onerror = () => {
      speakingMsgIdRef.current = null;
      setSpeakingMsgId(null);
    };

    speechSynthesis.speak(utterance);
  }, []);

  // ── @멘션 핸들러 (닉네임 롱프레스) ──
  const handleMention = useCallback((name) => {
    setText(`@${name} `);
    setIsComposing(true);
  }, []);

  // ── 메시지 전송 ──
  const handleSend = useCallback(async (e) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    if (!currentUser) {
      navigate('/login');
      return;
    }

    // 도배 방지: 쿨다운 중이면 차단
    if (cooldownLeft > 0) return;

    const filterError = validateMessage(trimmed);
    if (filterError) {
      alert(filterError);
      return;
    }

    setText('');
    setIsSending(true);
    try {
      const newMsg = await loungeService.sendMessage(trimmed);
      // Realtime으로도 오겠지만 중복 방지 로직이 있으므로 미리 추가
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setCooldownLeft(15); // 15초 쿨다운 시작
      setIsComposing(false);
      requestAnimationFrame(() => scrollToBottom());
    } catch (e) {
      console.error('[Lounge] 전송 실패:', e);
      setText(trimmed); // 실패 시 복원
    } finally {
      setIsSending(false);
    }
  }, [text, isSending, cooldownLeft, currentUser, navigate, scrollToBottom]);

  // ── Enter(shift+enter는 줄바꿈)로 전송 ──
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // ── 메시지 삭제 ──
  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('이 메시지를 삭제하시겠습니까?')) return;
    try {
      await loungeService.deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.error('[Lounge] 삭제 실패:', e);
    }
  }, []);

  // ── 날짜 구분선 삽입을 위한 렌더링 준비 ──
  const renderedItems = [];
  let lastDateKey = null;
  for (const msg of messages) {
    const dk = getDateKey(msg.created_at);
    if (dk !== lastDateKey) {
      renderedItems.push({ type: 'date', key: `date-${dk}`, label: formatDateLabel(dk) });
      lastDateKey = dk;
    }
    renderedItems.push({ type: 'msg', key: msg.id, msg });
  }

  return (
    <>
    <div
      className="flex flex-col bg-[#F5F5F5]"
      style={{ height: '100dvh', paddingTop: '56px' }}
    >
      {/* 컨텍스트 바 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 py-1.5 text-center">
        <span className="text-[12px] font-medium text-orange-500">광장</span>
        <span className="text-[12px] text-gray-400"> · 회원들의 이야기</span>
      </div>

      {/* 메시지 목록 */}
      <main
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto overscroll-contain relative"
        style={{ paddingBottom: '160px' }}
      >
        {/* 이전 메시지 로딩 센티넬 */}
        <div ref={topSentinelRef} className="h-1" />

        {isLoadingMore && (
          <div className="flex justify-center py-3">
            <span className="loading loading-spinner loading-sm text-orange-400" />
          </div>
        )}

        {!hasMore && messages.length > 0 && (
          <p className="text-center text-[12px] text-gray-400 py-4">처음부터 보고 있어요</p>
        )}

        {messages.length === 0 && !isLoadingMore && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <p className="text-[15px]">아직 아무도 이야기하지 않았어요</p>
            <p className="text-[13px]">첫 번째 글을 남겨보세요!</p>
          </div>
        )}

        {/* 날짜 구분선 + 메시지 */}
        <div className="py-2">
          {renderedItems.map((item) => {
            if (item.type === 'date') {
              return (
                <div key={item.key} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[12px] text-gray-400 font-medium flex-shrink-0">
                    {item.label}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              );
            }
            return (
              <LoungeMessage
                key={item.key}
                msg={item.msg}
                currentUserId={currentUser?.id}
                onDelete={handleDelete}
                onTTS={handleTTS}
                onMention={handleMention}
                isSpeaking={speakingMsgId === item.msg.id}
              />
            );
          })}
        </div>

        {/* 새 메시지 버튼 - 스크롤 영역 하단에 sticky */}
        {showScrollDown && (
          <div className="sticky bottom-2 flex justify-center pointer-events-none">
            <button
              onClick={() => { scrollToBottom(); setShowScrollDown(false); }}
              className="pointer-events-auto flex items-center gap-1 bg-orange-500 text-white text-[12px] font-medium px-3 py-1.5 rounded-full shadow-lg"
            >
              <KeyboardArrowDownIcon style={{ fontSize: 16 }} />
              새 메시지
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

    </div>

    {/* 플로팅 글쓰기 버튼 */}
    {!isComposing && (
      <button
        onClick={() => setIsComposing(true)}
        className="fixed right-4 z-40 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-full shadow-lg p-3 transition-all duration-300 hover:shadow-xl active:scale-95"
        style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 8px)' }}
        aria-label="광장에 글쓰기"
      >
        <SendIcon style={{ fontSize: 22 }} />
      </button>
    )}

    {/* 글쓰기 모달 - 화면 상단에 띄워 키보드와 충돌 방지 */}
    {isComposing && (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-start pt-20">
        {/* 배경 */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => { if (!text.trim()) setIsComposing(false); }}
        />
        {/* 카드 */}
        <div className="relative w-[calc(100%-32px)] bg-white rounded-2xl shadow-xl border-2 border-blue-400 overflow-hidden">
          {/* 헤더 */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500" />
              <span className="text-[18px] font-bold text-gray-800">광장에 한마디</span>
            </div>
            <button
              onClick={() => { setText(''); setIsComposing(false); }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-[16px] hover:bg-gray-200 transition-colors"
            >
              ×
            </button>
          </div>

          {!currentUser ? (
            <div className="px-5 py-5">
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 text-[14px] font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
              >
                로그인하고 이야기 나누기
              </button>
            </div>
          ) : (
            <>
              {/* 입력창 */}
              <div className="px-5 pt-4 pb-3">
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="이야기를 남겨보세요... (최대 300자)"
                  maxLength={300}
                  rows={3}
                  autoFocus
                  className="w-full px-4 py-3 border-2 border-blue-400 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-500 text-[15px] resize-none leading-relaxed text-gray-800 placeholder-gray-400 bg-gray-50 outline-none transition-all duration-200"
                  style={{ fontSize: '16px', minHeight: '84px', maxHeight: '120px', overflowY: 'auto' }}
                />
              </div>
              {/* 푸터 */}
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className={`text-[12px] transition-colors ${cooldownLeft > 0 ? 'text-orange-400 font-medium' : text.length > 0 ? 'text-gray-400' : 'text-transparent'}`}>
                  {cooldownLeft > 0 ? `${cooldownLeft}초 후 전송 가능` : `${text.length}/300`}
                </span>
                <button
                  onClick={handleSend}
                  disabled={!text.trim() || isSending || cooldownLeft > 0}
                  className="px-6 py-2.5 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white text-[14px] font-bold rounded-xl shadow-sm disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed transition-all duration-300"
                >
                  전송
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
};

export default Lounge;
