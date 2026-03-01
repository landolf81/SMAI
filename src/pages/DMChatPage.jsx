import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dmService, userService, storageService } from '../services';
import { AuthContext } from '../context/AuthContext';

// 아이콘
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';

// 날짜 포맷 함수 (moment 대신 직접 구현)
const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatDateLabel = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = date.toDateString();
  if (dateOnly === today.toDateString()) return '오늘';
  if (dateOnly === yesterday.toDateString()) return '어제';

  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
};

const getDateKey = (dateStr) => {
  return new Date(dateStr).toISOString().split('T')[0];
};

const DMChatPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = React.useRef(null);
  const isInitialMount = React.useRef(true);

  // 상대방 정보 가져오기
  const { data: otherUser } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userService.getUser(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5분간 캐시
  });

  // DM 창이 열릴 때 모든 메시지를 읽음으로 표시 (한 번만)
  // DB 업데이트 완료 후 즉시 invalidate → 뱃지 즉시 소멸
  useEffect(() => {
    if (userId && isInitialMount.current) {
      isInitialMount.current = false;
      dmService.markAllAsReadFromUser(userId).then(() => {
        queryClient.invalidateQueries(['unreadCount']);
        queryClient.invalidateQueries(['conversations']);
      }).catch(() => {});
    }
  }, [userId, queryClient]);

  // 메시지 목록 조회
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', userId],
    queryFn: () => dmService.getMessages(userId),
    enabled: !!userId,
    refetchInterval: 5000, // 5초로 늘림
    staleTime: 2000,
  });

  // 메시지 전송 뮤테이션 (Optimistic Update)
  const sendMessageMutation = useMutation({
    mutationFn: (content) =>
      dmService.sendMessage({
        receiverId: userId,
        content
      }),
    // 즉시 UI에 반영 (Optimistic Update)
    onMutate: async (content) => {
      // 진행 중인 refetch 취소
      await queryClient.cancelQueries(['messages', userId]);

      // 이전 데이터 저장
      const previousMessages = queryClient.getQueryData(['messages', userId]);

      // 임시 메시지 추가
      const tempMessage = {
        id: `temp-${Date.now()}`,
        sender_id: currentUser?.id,
        receiver_id: userId,
        content,
        created_at: new Date().toISOString(),
        is_read: false,
        _isOptimistic: true
      };

      queryClient.setQueryData(['messages', userId], (old = []) => [...old, tempMessage]);

      return { previousMessages };
    },
    onError: (error, content, context) => {
      // 에러 시 이전 데이터로 롤백
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', userId], context.previousMessages);
      }
      console.error('메시지 전송 실패:', error);
      alert('메시지 전송에 실패했습니다.');
    },
    onSettled: () => {
      // 성공/실패 상관없이 서버 데이터로 동기화
      queryClient.invalidateQueries(['messages', userId]);
    }
  });

  // 메시지 전송 핸들러
  const handleSend = useCallback((e) => {
    e.preventDefault();
    const text = messageText.trim();
    if (text) {
      setMessageText(''); // 즉시 입력창 비우기
      sendMessageMutation.mutate(text);
    }
  }, [messageText, sendMessageMutation]);

  // 새 메시지 도착 시 스크롤 (부드럽게가 아닌 즉시)
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages.length]);

  // 메시지 날짜 그룹핑 (메모이제이션)
  const messageGroups = useMemo(() => {
    const groups = {};
    messages.forEach(msg => {
      const date = getDateKey(msg.created_at);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  }, [messages]);

  // 프로필 이미지 URL
  const profileUrl = useMemo(() => {
    return storageService.getProfileImageUrl(otherUser?.profile_pic, otherUser?.id);
  }, [otherUser?.profile_pic, otherUser?.id]);

  // 뒤로가기
  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <div className="fixed inset-0 flex flex-col bg-cloud-dancer" style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}>
      {/* 헤더 - 고정 */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm z-10">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 text-gray-600 active:bg-gray-100 rounded-full"
        >
          <ArrowBackIcon />
        </button>

        <img
          src={profileUrl}
          alt={otherUser?.name || '사용자'}
          className="w-10 h-10 rounded-full object-cover"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/default/default_profile.png';
          }}
        />

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">
            {otherUser?.name || otherUser?.username || '로딩 중...'}
          </h1>
          {otherUser?.username && otherUser?.name !== otherUser?.username && (
            <p className="text-sm text-gray-500 truncate">@{otherUser.username}</p>
          )}
        </div>
      </header>

      {/* 메시지 목록 - 스크롤 영역 */}
      <main className="flex-1 overflow-y-auto px-4 py-3 overscroll-contain">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-500">메시지를 불러오는 중...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full text-gray-500">
            <p>아직 대화가 없습니다</p>
            <p className="text-sm">메시지를 보내 대화를 시작하세요</p>
          </div>
        ) : (
          <>
            {Object.entries(messageGroups).map(([date, msgs]) => (
              <React.Fragment key={date}>
                {/* 날짜 구분선 */}
                <div className="flex items-center my-4">
                  <div className="flex-1 h-px bg-gray-300"></div>
                  <span className="px-3 text-sm text-gray-500 font-medium">
                    {formatDateLabel(date)}
                  </span>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>

                {/* 메시지들 */}
                {msgs.map((msg) => {
                  const isMyMessage = msg.sender_id === currentUser?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex mb-3 ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-[75%]">
                        <div
                          className={`px-4 py-2.5 rounded-2xl ${
                            isMyMessage
                              ? 'bg-yellow-200 text-gray-900 rounded-br-sm'
                              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
                          }`}
                        >
                          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        </div>
                        <p className={`text-xs text-gray-400 mt-1 ${isMyMessage ? 'text-right' : 'text-left'}`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </main>

      {/* 입력창 - 고정 */}
      <footer className="flex-shrink-0 bg-white border-t border-gray-200 p-3" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0))' }}>
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="메시지를 입력하세요..."
            className="flex-1 px-4 py-3 bg-gray-100 rounded-full text-base outline-none focus:ring-2 focus:ring-green-400 focus:bg-white"
            style={{ fontSize: '16px' }}
          />
          <button
            type="submit"
            disabled={!messageText.trim() || sendMessageMutation.isPending}
            className="p-3 bg-green-500 text-white rounded-full active:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <SendIcon />
          </button>
        </form>
      </footer>
    </div>
  );
};

export default DMChatPage;
