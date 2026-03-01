/**
 * Lounge.jsx
 * 역할: 광장 - 회원들이 짧은 텍스트 글을 나누는 단체 채팅방
 * 특징: 실시간 수신, 위로 스크롤 시 이전 메시지 로드, 텍스트 전용
 */
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import loungeService from '../services/loungeService';
import { storageService } from '../services';
import { generateDiceBearAvatar } from '../utils/userHelper';
import SendIcon from '@mui/icons-material/Send';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AIBadge from '../components/AIBadge';
import { AI_USER_ID } from '../config/aiUser';

// 시간 포맷 (오늘이면 시:분, 아니면 날짜)
const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
};

// 전송 금지 패턴 검사 (전화번호, 음란·폭력 단어)
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

// 날짜 구분선 표시용 키
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

const LoungeMessage = React.memo(({ msg, currentUserId, onDelete }) => {
  const user = msg.users || {};
  const profileUrl = storageService.getProfileImageUrl(user.profile_pic, user.id);
  const displayName = user.name || user.username || '알 수 없음';
  const isMe = msg.user_id === currentUserId;
  const isAI = msg.user_id === AI_USER_ID;

  return (
    <div className={`flex items-start gap-2.5 px-4 py-1.5 group ${isMe ? 'bg-orange-50 border-l-2 border-orange-400' : ''}`}>
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
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold text-gray-800">{displayName}</span>
          {isAI && <AIBadge />}
          <span className="text-[12px] text-gray-400">{formatTime(msg.created_at)}</span>
          {isMe && (
            <button
              onClick={() => onDelete(msg.id)}
              className="text-[11px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
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

const Lounge = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const scrollAreaRef = useRef(null);
  const topSentinelRef = useRef(null);
  const bottomRef = useRef(null);
  const subscriptionRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const containerRef = useRef(null);
  const inputFooterRef = useRef(null);

  // 하단 여부 체크
  const checkIsAtBottom = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  // 하단으로 스크롤
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // 마운트 시 초기 paddingBottom 설정 (fixed 입력창 높이만큼)
  useLayoutEffect(() => {
    const footer = inputFooterRef.current;
    const el = scrollAreaRef.current;
    if (footer && el) {
      el.style.paddingBottom = `${footer.offsetHeight}px`;
    }
  }, []);

  // iOS 키보드 감지: visualViewport resize 시 fixed 입력창 bottom 위치 조정
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let prevKeyboardHeight = 0;
    const update = () => {
      const footer = inputFooterRef.current;
      const scrollEl = scrollAreaRef.current;
      if (!footer) return;
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const inputBottom = keyboardHeight > 50 ? keyboardHeight : 80;
      footer.style.bottom = `${inputBottom}px`;
      if (scrollEl) scrollEl.style.paddingBottom = `${footer.offsetHeight}px`;
      // 키보드가 방금 열렸으면 하단으로 스크롤
      if (keyboardHeight > 50 && prevKeyboardHeight <= 50) {
        requestAnimationFrame(() => scrollToBottom('auto'));
      }
      prevKeyboardHeight = keyboardHeight;
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [scrollToBottom]);

  // 초기 메시지 로드
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

  // Realtime 구독
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

  // 스크롤 이벤트: 하단 여부 추적
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

  // 위 센티넬 IntersectionObserver (이전 메시지 로드)
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

  // 메시지 전송
  const handleSend = useCallback(async (e) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    if (!currentUser) {
      navigate('/login');
      return;
    }

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
      requestAnimationFrame(() => scrollToBottom());
    } catch (e) {
      console.error('[Lounge] 전송 실패:', e);
      setText(trimmed); // 실패 시 복원
    } finally {
      setIsSending(false);
    }
  }, [text, isSending, currentUser, navigate, scrollToBottom]);

  // Enter(shift+enter는 줄바꿈)로 전송
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // 메시지 삭제
  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('이 메시지를 삭제하시겠습니까?')) return;
    try {
      await loungeService.deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.error('[Lounge] 삭제 실패:', e);
    }
  }, []);

  // 날짜 구분선 삽입을 위한 렌더링 준비
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
    // Navbar(56px) 아래부터 전체 채우는 flex 컨테이너 (입력창은 fixed로 분리)
    <div
      ref={containerRef}
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

      {/* 입력창 - fixed 플로팅: 키보드 없을 때 80px(바텀 네비 위), 키보드 열리면 keyboardHeight */}
      <footer
        ref={inputFooterRef}
        className="fixed left-0 right-0 bg-white border-t border-gray-200 px-3 py-2 z-40"
        style={{ bottom: '80px' }}
      >
        {!currentUser ? (
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 text-[14px] text-gray-500 bg-gray-100 rounded-full"
          >
            로그인하고 이야기 나누기
          </button>
        ) : (
          <form onSubmit={handleSend} className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="이야기를 남겨보세요... (최대 300자)"
              maxLength={300}
              rows={1}
              className="flex-1 px-4 py-2.5 bg-gray-100 rounded-2xl text-[15px] outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none leading-relaxed"
              style={{ fontSize: '16px', maxHeight: '80px', overflowY: 'auto' }}
            />
            <button
              type="submit"
              disabled={!text.trim() || isSending}
              className="p-2.5 bg-orange-500 text-white rounded-full disabled:bg-gray-300 disabled:cursor-not-allowed flex-shrink-0 active:bg-orange-600"
            >
              <SendIcon style={{ fontSize: 20 }} />
            </button>
          </form>
        )}
        {text.length > 0 && (
          <p className="text-right text-[11px] text-gray-400 mt-1 pr-12">
            {text.length}/300
          </p>
        )}
      </footer>
    </div>
  );
};

export default Lounge;
