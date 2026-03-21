/**
 * Lounge.jsx
 * 역할: 광장 - 회원들이 짧은 텍스트 글을 나누는 피드
 * 특징:
 *   - 최신글이 최상단에 표시 (피드형)
 *   - 실시간 수신 (Supabase Realtime) → 상단에 새 글 삽입
 *   - 아래로 스크롤 시 이전 메시지 로드 (IntersectionObserver)
 *   - 텍스트 전용, 도배 방지 15초 쿨다운
 *   - 메시지 롱프레스 → TTS (Web Speech API, ko-KR)
 *   - 닉네임 롱프레스 → @멘션 입력창 열기
 */
import React, { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import loungeService from '../services/loungeService';
import loungePollService from '../services/loungePollService';
import { storageService } from '../services';
import { uploadVideo } from '../services/videoUploadService';
import { generateDiceBearAvatar } from '../utils/userHelper';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import LoadingSpinner from '../components/LoadingSpinner';
import AIBadge from '../components/AIBadge';
import { AI_USER_ID } from '../config/aiUser';
import PollBadge from '../components/lounge/PollBadge';
import PollCard from '../components/lounge/PollCard';
import LoungeAdMessage from '../components/lounge/LoungeAdMessage';
import { useScrollDirection } from '../hooks/useScrollDirection';
import LoungeComposeModal from '../components/lounge/LoungeComposeModal';
import LoungeImageScroll from '../components/lounge/LoungeImageScroll';
import ProfileModal from '../components/ProfileModal';
import { adService } from '../services';
import { sortAdsByPriority, getAdViewCounts } from '../utils/adPriority';

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
const getDateKey = (dateStr) => {
  const d = new Date(dateStr);
  // 한국 시간 기준 날짜 키 (YYYY-MM-DD)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateLabel = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  if (dateKey === todayKey) return '오늘';
  if (dateKey === yesterdayKey) return '어제';
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
};

const LONG_PRESS_DELAY = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10;

// ─────────────────────────────────────────────
// @멘션 하이라이트 렌더링 (닉네임 목록 기반 greedy match)
// ─────────────────────────────────────────────
const renderContent = (content, knownNames) => {
  if (!content || !knownNames || knownNames.length === 0) return content;

  // 긴 닉네임부터 매칭 (greedy)
  const sorted = [...knownNames].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const splitPattern = new RegExp(`(@(?:${escaped.join('|')}))(?=\\s|$)`, 'g');
  const testPattern = new RegExp(`^@(?:${escaped.join('|')})$`);

  const parts = content.split(splitPattern);
  return parts.map((part, i) =>
    testPattern.test(part)
      ? <span key={i} className="text-blue-500 font-semibold">{part}</span>
      : part
  );
};

// ─────────────────────────────────────────────
// LoungeMessage
// props: msg, currentUserId, onDelete, onTTS, onMention, isSpeaking, isAdmin, onHide, knownNames
// ─────────────────────────────────────────────
const LoungeMessage = React.memo(({ msg, currentUserId, onDelete, onAdminDelete, onTTS, onMention, onProfileClick, isSpeaking, isAdmin, onHide, onImageClick, knownNames, myPollVotes, onVote, onClosePoll, isVoting }) => {
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

  // 닉네임 클릭 → 프로필 모달 (롱프레스가 아닐 때만)
  const handleNameClick = useCallback(() => {
    // 롱프레스 직후가 아닌 일반 클릭일 때만 프로필 열기
    if (!nameFiredRef.current) {
      onProfileClick?.(user);
    }
  }, [user, onProfileClick]);

  useEffect(() => () => clearTimeout(nameTimerRef.current), []);

  const isHidden = msg.is_hidden;

  return (
    <div
      className={`flex items-start gap-2.5 px-4 py-2 group border-b border-base-300/60 ${
        isMe ? 'bg-warning/10 border-l-2 border-orange-400' : ''
      } ${isSpeaking ? 'bg-info/10' : ''} ${isHidden ? 'opacity-40' : ''}`}
    >
      <img
        src={profileUrl}
        alt={displayName}
        className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5 cursor-pointer"
        onClick={() => onProfileClick?.(user)}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = generateDiceBearAvatar(user.id || 'default');
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {/* 닉네임 — 롱프레스 시 @멘션 */}
          <span
            className="text-[15px] font-semibold text-base-content select-none cursor-pointer"
            style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
            onClick={handleNameClick}
            onTouchStart={handleNameTouchStart}
            onTouchMove={handleNameTouchMove}
            onTouchEnd={handleNameTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
          >
            {displayName}
          </span>
          {isAI && <AIBadge />}
          {msg.poll_id && <PollBadge />}
          {isHidden && <span className="text-[10px] text-red-400 font-medium">숨김</span>}
          <span className="text-[12px] text-base-content/40">{formatTime(msg.created_at)}</span>
          {/* TTS 버튼 */}
          <button
            onClick={() => onTTS?.(msg.content, msg.id)}
            className={`p-0.5 rounded transition-colors ${isSpeaking ? 'text-blue-500' : 'text-base-content/40 active:text-blue-400'}`}
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
              className="text-[11px] text-base-content/50 ml-auto"
            >
              삭제
            </button>
          )}
          {isAdmin && (
            <>
              <button
                onClick={() => onHide(msg.id, !isHidden)}
                className={`text-[11px] ${isMe ? '' : 'ml-auto'} ${isHidden ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}`}
              >
                {isHidden ? '복구' : '숨기기'}
              </button>
              <button
                onClick={() => onAdminDelete(msg.id)}
                className="text-[11px] text-red-500 font-medium"
              >
                삭제
              </button>
            </>
          )}
        </div>
        {msg.content && (
          <p className="text-[16px] text-base-content leading-relaxed whitespace-pre-wrap break-words mt-0.5">
            {renderContent(msg.content, knownNames)}
          </p>
        )}
        {(msg.image_url || (msg.image_urls && msg.image_urls.length > 0)) && (
          <LoungeImageScroll
            imageUrl={msg.image_url}
            imageUrls={msg.image_urls}
            onImageClick={onImageClick}
          />
        )}
        {msg.video_url && (() => {
          // Cloudflare Stream → HLS URL로 변환하여 <video>로 재생 (비율 자동 맞춤)
          const streamMatch = msg.video_url.match(/cloudflarestream\.com\/([a-zA-Z0-9]+)/);
          if (streamMatch) {
            const uid = streamMatch[1];
            const hlsUrl = `https://customer-xi3tfx9anf8ild8c.cloudflarestream.com/${uid}/manifest/video.m3u8`;
            const thumbUrl = `https://customer-xi3tfx9anf8ild8c.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg?width=280`;
            return (
              <div className="mt-1.5 w-[280px] rounded-xl border border-base-300 overflow-hidden bg-black">
                <video
                  src={hlsUrl}
                  poster={thumbUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full block"
                />
              </div>
            );
          }
          return (
            <div className="mt-1.5 w-[280px] rounded-xl border border-base-300 overflow-hidden bg-black">
              <video
                src={msg.video_url}
                controls
                playsInline
                preload="metadata"
                className="w-full block"
              />
            </div>
          );
        })()}
        {msg.lounge_polls && (
          <PollCard
            poll={msg.lounge_polls}
            myVotes={myPollVotes || []}
            onVote={onVote}
            onClose={onClosePoll}
            currentUserId={currentUserId}
            isVoting={isVoting}
          />
        )}
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
  const scrollDirection = useScrollDirection();
  const [messages, setMessages] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true); // 최초 로드 중
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showScrollUp, setShowScrollUp] = useState(false);  // 새 메시지 알림 (상단)

  const [isComposing, setIsComposing] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [isUploading, setIsUploading] = useState(false);        // 업로드 중 여부
  const [viewingImage, setViewingImage] = useState(null);       // 전체화면 보기 URL
  const [myPollVotes, setMyPollVotes] = useState({});           // { pollId: [optionId, ...] }
  const [votingPollId, setVotingPollId] = useState(null);       // 투표 처리 중인 pollId
  const [loungeAds, setLoungeAds] = useState([]);               // 광장 피드 광고
  const [mentionText, setMentionText] = useState('');           // @멘션 초기 텍스트
  const [profileUser, setProfileUser] = useState(null);         // 프로필 모달 대상 유저
  const [showProfileModal, setShowProfileModal] = useState(false); // 프로필 모달 열림 여부
  const pollVoteSubRef = useRef(null);

  // 로드된 메시지의 닉네임 목록 (멘션 하이라이트용)
  const knownNames = useMemo(() => {
    const names = new Set();
    for (const m of messages) {
      const name = m.users?.name;
      if (name) names.add(name);
    }
    return [...names];
  }, [messages]);

  // TTS: 현재 재생 중인 메시지 ID
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  // ref로 관리해 stale closure 없이 toggle 판단
  const speakingMsgIdRef = useRef(null);

  const scrollAreaRef = useRef(null);
  const bottomSentinelRef = useRef(null);   // 이전 메시지 로드 센티넬 (하단)
  const subscriptionRef = useRef(null);
  const isAtTopRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  // ── 내부 스크롤 → 상하단 바 숨김/표시 (홈과 동일 매커니즘) ──
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;

    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollTop = el.scrollTop;
        const last = lastScrollTopRef.current;

        // 상단 근처면 항상 바 표시
        if (scrollTop < 50) {
          window.dispatchEvent(new CustomEvent('scroll-direction-override', { detail: { direction: 'up' } }));
        } else if (scrollTop !== last) {
          const dir = scrollTop > last ? 'down' : 'up';
          window.dispatchEvent(new CustomEvent('scroll-direction-override', { detail: { direction: dir } }));
        }

        lastScrollTopRef.current = scrollTop;
        ticking = false;
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    // 언마운트 시 바 다시 표시
    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.dispatchEvent(new CustomEvent('scroll-direction-override', { detail: { direction: 'up' } }));
    };
  }, []);

  // ── 상단 여부 체크 ──
  const checkIsAtTop = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return true;
    return el.scrollTop < 120;
  }, []);

  // ── 상단으로 스크롤 ──
  const scrollToTop = useCallback((behavior = 'smooth') => {
    const el = scrollAreaRef.current;
    if (el) el.scrollTo({ top: 0, behavior });
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

  // ── 광장 피드 광고 로드 ──
  useEffect(() => {
    let cancelled = false;
    adService.getActiveAds()
      .then((ads) => {
        if (!cancelled && ads?.length > 0) {
          setLoungeAds(sortAdsByPriority(ads, getAdViewCounts()));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ── 초기 메시지 로드 (최신순) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loungeService.getMessages({ limit: 30 });
        if (!cancelled) {
          setMessages(data);
          setHasMore(data.length === 30);
          setIsInitialLoading(false);
          // 투표가 포함된 메시지에서 내 투표 데이터 로드
          const pollIds = data.filter((m) => m.poll_id).map((m) => m.poll_id);
          if (pollIds.length > 0) {
            loungePollService.batchGetMyVotes(pollIds).then((votes) => {
              if (!cancelled) setMyPollVotes(votes);
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.error('[Lounge] 메시지 로드 실패:', e);
        if (!cancelled) setIsInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Realtime 구독 (새 메시지 → 상단에 삽입) ──
  useEffect(() => {
    subscriptionRef.current = loungeService.subscribeToNewMessages((newMsg) => {
      const el = scrollAreaRef.current;
      const prevScrollHeight = el?.scrollHeight || 0;

      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [newMsg, ...prev];  // 최신순: 상단에 삽입
      });

      // 상단에 있으면 새 메시지 자동 표시, 아니면 알림 버튼
      if (isAtTopRef.current) {
        requestAnimationFrame(() => scrollToTop());
      } else {
        // 스크롤 위치 보정 (상단에 콘텐츠 추가되면 뷰포트가 밀리므로)
        requestAnimationFrame(() => {
          if (el) el.scrollTop += el.scrollHeight - prevScrollHeight;
        });
        setShowScrollUp(true);
      }
    });

    return () => subscriptionRef.current?.unsubscribe();
  }, [scrollToTop]);

  // ── 투표 Realtime 구독 (투표 변경 시 메시지 내 poll 데이터 갱신) ──
  useEffect(() => {
    pollVoteSubRef.current = loungePollService.subscribeToVotes(async (payload) => {
      const pollId = payload.new?.poll_id || payload.old?.poll_id;
      if (!pollId) return;
      try {
        const updatedPoll = await loungePollService.getPollData(pollId);
        setMessages((prev) =>
          prev.map((m) =>
            m.poll_id === pollId ? { ...m, lounge_polls: updatedPoll } : m
          )
        );
      } catch {
        // 무시
      }
    });
    return () => pollVoteSubRef.current?.unsubscribe();
  }, []);

  // ── 스크롤 이벤트: 상단 여부 추적 ──
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const onScroll = () => {
      isAtTopRef.current = checkIsAtTop();
      if (isAtTopRef.current) setShowScrollUp(false);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [checkIsAtTop]);

  // ── 하단 센티넬 IntersectionObserver (이전 메시지 로드) ──
  useEffect(() => {
    if (!bottomSentinelRef.current) return;

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        try {
          // 최신순이므로 마지막 항목이 가장 오래된 메시지
          const oldest = messages[messages.length - 1]?.created_at;
          if (!oldest) return;
          const older = await loungeService.getMessages({ beforeTime: oldest, limit: 30 });
          if (older.length === 0) {
            setHasMore(false);
            return;
          }
          // 하단에 추가 (스크롤 위치 보정 불필요 — 뷰포트 아래에 삽입)
          setMessages((prev) => [...prev, ...older]);
          setHasMore(older.length === 30);
        } catch (e) {
          console.error('[Lounge] 이전 메시지 로드 실패:', e);
        } finally {
          setIsLoadingMore(false);
        }
      },
      { threshold: 0 }
    );

    observer.observe(bottomSentinelRef.current);
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
    setMentionText(`@${name} `);
    setIsComposing(true);
  }, []);

  // ── 프로필 모달 핸들러 (프로필 이미지 / 닉네임 클릭) ──
  const handleProfileClick = useCallback((user) => {
    if (!user?.id) return;
    setProfileUser(user);
    setShowProfileModal(true);
  }, []);

  // ── 투표 핸들러 ──
  const handleVote = useCallback(async (pollId, optionId) => {
    if (votingPollId || !currentUser) return;
    setVotingPollId(pollId);

    // 해당 poll의 is_multiple 확인
    const msg = messages.find((m) => m.poll_id === pollId);
    const isMultiple = msg?.lounge_polls?.is_multiple || false;

    // 옵티미스틱 업데이트
    setMyPollVotes((prev) => {
      const current = prev[pollId] || [];
      if (current.includes(optionId)) {
        // 취소
        return { ...prev, [pollId]: current.filter((id) => id !== optionId) };
      }
      if (isMultiple) {
        return { ...prev, [pollId]: [...current, optionId] };
      }
      // 단일선택: 새 옵션으로 교체
      return { ...prev, [pollId]: [optionId] };
    });

    try {
      await loungePollService.toggleVote(pollId, optionId, isMultiple);
      // Realtime이 poll 데이터를 갱신해줌
    } catch (e) {
      console.error('[Lounge] 투표 실패:', e);
      // 롤백: 서버에서 실제 투표 상태 재조회
      try {
        const votes = await loungePollService.getMyVotes(pollId);
        setMyPollVotes((prev) => ({ ...prev, [pollId]: votes }));
      } catch { /* ignore */ }
    } finally {
      setVotingPollId(null);
    }
  }, [votingPollId, currentUser, messages]);

  // ── 투표 마감 핸들러 ──
  const handleClosePoll = useCallback(async (pollId) => {
    try {
      await loungePollService.closePoll(pollId);
      setMessages((prev) =>
        prev.map((m) =>
          m.poll_id === pollId
            ? { ...m, lounge_polls: { ...m.lounge_polls, is_closed: true } }
            : m
        )
      );
    } catch (e) {
      console.error('[Lounge] 투표 마감 실패:', e);
    }
  }, []);

  // ── 투표 생성 제출 (LoungeComposeModal에서 호출) ──
  const handlePollSubmit = useCallback(async (pollData) => {
    if (isSending || cooldownLeft > 0 || !currentUser) return;
    setIsSending(true);
    try {
      const newMsg = await loungePollService.createPoll(pollData);
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [newMsg, ...prev];
      });
      setCooldownLeft(15);
      setIsComposing(false);
      requestAnimationFrame(() => scrollToTop());
    } catch (e) {
      console.error('[Lounge] 투표 생성 실패:', e);
      alert('투표 생성에 실패했습니다.');
    } finally {
      setIsSending(false);
    }
  }, [isSending, cooldownLeft, currentUser, scrollToTop]);

  // ── 메시지 전송 (LoungeComposeModal에서 호출) ──
  const handleSend = useCallback(async (content, images, video) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (cooldownLeft > 0) return;

    if (content) {
      const filterError = validateMessage(content);
      if (filterError) {
        alert(filterError);
        return;
      }
    }

    setIsSending(true);
    const hasImages = images && images.length > 0;
    const hasVideo = !!video;
    setIsUploading(hasImages || hasVideo);

    try {
      let imageUrl = null;
      let imageUrls = null;
      let videoUrl = null;

      if (hasImages) {
        if (images.length === 1) {
          // 단일 이미지 → image_url (하위 호환)
          imageUrl = await loungeService.uploadLoungeImage(images[0]);
        } else {
          // 다중 이미지 → image_urls[]
          imageUrls = await loungeService.uploadLoungeImages(images);
        }
      }

      if (hasVideo) {
        const result = await uploadVideo(video, () => {});
        videoUrl = result.iframeUrl;
      }

      setIsUploading(false);

      const newMsg = await loungeService.sendMessage(content, imageUrl, imageUrls, videoUrl);
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [newMsg, ...prev];
      });
      setCooldownLeft(15);
      setIsComposing(false);
      setMentionText('');
      requestAnimationFrame(() => scrollToTop());
    } catch (e) {
      console.error('[Lounge] 전송 실패:', e);
      setIsUploading(false);
      throw e; // 모달에서 에러 처리 가능하도록
    } finally {
      setIsSending(false);
    }
  }, [cooldownLeft, currentUser, navigate, scrollToTop]);

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

  // ── 관리자 메시지 삭제 (hard delete) ──
  const handleAdminDelete = useCallback(async (id) => {
    if (!window.confirm('이 메시지를 완전히 삭제하시겠습니까?\n(복구 불가)')) return;
    try {
      await loungeService.deleteMessageAdmin(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.error('[Lounge] 관리자 삭제 실패:', e);
    }
  }, []);

  // ── 메시지 숨기기/복구 (관리자) ──
  const handleHide = useCallback(async (id, isHidden) => {
    const action = isHidden ? '숨기기' : '복구';
    if (!window.confirm(`이 메시지를 ${action}하시겠습니까?`)) return;
    try {
      await loungeService.hideMessage(id, isHidden);
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, is_hidden: isHidden } : m));
    } catch (e) {
      console.error(`[Lounge] ${action} 실패:`, e);
    }
  }, []);

  // ── 날짜 구분선 + 광고 삽입을 위한 렌더링 준비 ──
  const LOUNGE_AD_INTERVAL = 15; // 15개 메시지마다 광고 1개
  const isAdmin = currentUser?.isAdmin;
  const visibleMessages = isAdmin ? messages : messages.filter((m) => !m.is_hidden);
  const renderedItems = [];
  let lastDateKey = null;
  let messageCount = 0;
  let adIndex = 0;
  for (const msg of visibleMessages) {
    const dk = getDateKey(msg.created_at);
    if (dk !== lastDateKey) {
      renderedItems.push({ type: 'date', key: `date-${dk}`, label: formatDateLabel(dk) });
      lastDateKey = dk;
    }
    renderedItems.push({ type: 'msg', key: msg.id, msg });
    messageCount++;
    // 광고 삽입
    if (loungeAds.length > 0 && messageCount % LOUNGE_AD_INTERVAL === 0) {
      const ad = loungeAds[adIndex % loungeAds.length];
      renderedItems.push({ type: 'ad', key: `lounge-ad-${ad.id}-${messageCount}`, ad });
      adIndex++;
    }
  }

  return (
    <>
    <div
      className="flex flex-col bg-base-100 transition-[padding] duration-150"
      style={{ height: '100dvh', paddingTop: scrollDirection === 'down' ? '0px' : '56px' }}
    >
      {/* 메시지 목록 */}
      <main
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto overscroll-contain relative"
        style={{ paddingBottom: '100px' }}
      >
        {/* 새 메시지 알림 버튼 - 스크롤 영역 상단에 sticky */}
        {showScrollUp && (
          <div className="sticky top-2 z-10 flex justify-center pointer-events-none">
            <button
              onClick={() => { scrollToTop(); setShowScrollUp(false); }}
              className="pointer-events-auto flex items-center gap-1 bg-orange-500 text-white text-[12px] font-medium px-3 py-1.5 rounded-full shadow-lg"
            >
              <KeyboardArrowUpIcon style={{ fontSize: 16 }} />
              새 글
            </button>
          </div>
        )}

        {messages.length === 0 && (isInitialLoading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="lg" />
          </div>
        ) : !isLoadingMore && (
          <div className="flex flex-col items-center justify-center h-full text-base-content/40 gap-2">
            <p className="text-[15px]">아직 아무도 이야기하지 않았어요</p>
            <p className="text-[13px]">첫 번째 글을 남겨보세요!</p>
          </div>
        ))}

        {/* 날짜 구분선 + 메시지 (최신순) */}
        <div className="py-2">
          {renderedItems.map((item) => {
            if (item.type === 'date') {
              return (
                <div key={item.key} className="flex justify-center py-3">
                  <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-3 py-1 rounded-full shadow-sm">
                    {item.label}
                  </span>
                </div>
              );
            }
            if (item.type === 'ad') {
              return (
                <LoungeAdMessage
                  key={item.key}
                  ad={item.ad}
                  onImageClick={setViewingImage}
                />
              );
            }
            return (
              <LoungeMessage
                key={item.key}
                msg={item.msg}
                currentUserId={currentUser?.id}
                onDelete={handleDelete}
                onAdminDelete={handleAdminDelete}
                onTTS={handleTTS}
                onMention={handleMention}
                onProfileClick={handleProfileClick}
                isSpeaking={speakingMsgId === item.msg.id}
                isAdmin={isAdmin}
                onHide={handleHide}
                onImageClick={setViewingImage}
                knownNames={knownNames}
                myPollVotes={item.msg.poll_id ? (myPollVotes[item.msg.poll_id] || []) : undefined}
                onVote={handleVote}
                onClosePoll={handleClosePoll}
                isVoting={votingPollId === item.msg.poll_id}
              />
            );
          })}
        </div>

        {/* 이전 메시지 로딩 */}
        {isLoadingMore && (
          <div className="flex justify-center py-3">
            <span className="loading loading-spinner loading-sm text-orange-400" />
          </div>
        )}

        {!hasMore && messages.length > 0 && (
          <p className="text-center text-[12px] text-base-content/40 py-4">모든 메시지를 불러왔어요</p>
        )}

        {/* 이전 메시지 로드 센티넬 (하단) */}
        <div ref={bottomSentinelRef} className="h-1" />
      </main>

    </div>

    {/* 플로팅 글쓰기 버튼 */}
    {!isComposing && (
      <div className={`fixed right-4 z-40 transition-all duration-300 ${scrollDirection === 'down' ? 'translate-x-20' : 'translate-x-0'}`} style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 8px)' }}>
        <button
          onClick={() => { setMentionText(''); setIsComposing(true); }}
          className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-full shadow-lg p-3.5 transition-all duration-300 hover:shadow-xl active:scale-95"
          aria-label="광장에 글쓰기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
          </svg>
        </button>
      </div>
    )}

    {/* 글쓰기 모달 (음성입력 + 다중 이미지 지원) */}
    <LoungeComposeModal
      isOpen={isComposing}
      onClose={() => { setIsComposing(false); setMentionText(''); }}
      currentUser={currentUser}
      onSendMessage={handleSend}
      onSendPoll={handlePollSubmit}
      isSending={isSending}
      cooldownLeft={cooldownLeft}
      isUploading={isUploading}
      initialText={mentionText}
    />
    {/* 프로필 모달 */}
    <ProfileModal
      isOpen={showProfileModal}
      onClose={() => { setShowProfileModal(false); setProfileUser(null); }}
      user={profileUser}
    />
    {/* 이미지 전체화면 뷰어 */}
    {viewingImage && (
      <div
        className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
        onClick={() => setViewingImage(null)}
      >
        <button
          className="absolute top-4 right-4 w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center text-[20px] backdrop-blur-sm"
          onClick={() => setViewingImage(null)}
        >
          ×
        </button>
        <img
          src={viewingImage}
          alt="전체화면"
          className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
    </>
  );
};

export default Lounge;
