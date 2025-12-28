import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dmService, userService } from '../services';
import { AuthContext } from '../context/AuthContext';
import moment from 'moment';
import 'moment/locale/ko';

// 아이콘
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';

moment.locale('ko');

const DMChatPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = React.useRef(null);

  // 상대방 정보 가져오기
  const { data: otherUser } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userService.getUserById(userId),
    enabled: !!userId,
  });

  // DM 창이 열릴 때 모든 메시지를 읽음으로 표시
  useEffect(() => {
    if (userId) {
      dmService.markAllAsReadFromUser(userId).then(() => {
        queryClient.invalidateQueries(['conversations']);
        queryClient.invalidateQueries(['unreadCount']);
      });
    }
  }, [userId, queryClient]);

  // 메시지 목록 조회
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', userId],
    queryFn: () => dmService.getMessages(userId),
    enabled: !!userId,
    refetchInterval: 3000
  });

  // 메시지 전송 뮤테이션
  const sendMessageMutation = useMutation({
    mutationFn: (content) =>
      dmService.sendMessage({
        receiverId: userId,
        content
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages', userId]);
      queryClient.invalidateQueries(['conversations']);
      setMessageText('');
    },
    onError: (error) => {
      console.error('메시지 전송 실패:', error);
      alert('메시지 전송에 실패했습니다.');
    }
  });

  // 메시지 전송 핸들러
  const handleSend = (e) => {
    e.preventDefault();
    if (messageText.trim()) {
      sendMessageMutation.mutate(messageText.trim());
    }
  };

  // 새 메시지 도착 시 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 메시지 날짜 그룹핑
  const groupMessagesByDate = (messages) => {
    const groups = {};
    messages.forEach(msg => {
      const date = moment(msg.created_at).format('YYYY-MM-DD');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  // 날짜 포맷
  const formatDate = (date) => {
    return moment(date).calendar(null, {
      sameDay: '오늘',
      lastDay: '어제',
      lastWeek: 'M월 D일',
      sameElse: 'YYYY년 M월 D일'
    });
  };

  // 프로필 이미지 URL
  const getProfileUrl = () => {
    if (!otherUser?.profile_pic) return '/default/default_profile.png';
    if (otherUser.profile_pic.startsWith('http')) return otherUser.profile_pic;
    if (otherUser.profile_pic.startsWith('/uploads/')) return otherUser.profile_pic;
    return `/uploads/profiles/${otherUser.profile_pic}`;
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-50">
      {/* 헤더 - 고정 */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowBackIcon />
        </button>

        <img
          src={getProfileUrl()}
          alt={otherUser?.name || '사용자'}
          className="w-10 h-10 rounded-full object-cover border-2 border-green-400"
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
      <main className="flex-1 overflow-y-auto px-4 py-3">
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
                    {formatDate(date)}
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
                      <div className={`max-w-[75%] ${isMyMessage ? 'order-1' : ''}`}>
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
                          {moment(msg.created_at).format('HH:mm')}
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
      <footer className="flex-shrink-0 bg-white border-t border-gray-200 p-3 safe-area-bottom">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="메시지를 입력하세요..."
            className="flex-1 px-4 py-3 bg-gray-100 rounded-full text-base outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all"
            style={{ fontSize: '16px' }} // iOS 확대 방지
          />
          <button
            type="submit"
            disabled={!messageText.trim() || sendMessageMutation.isLoading}
            className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <SendIcon />
          </button>
        </form>
      </footer>
    </div>
  );
};

export default DMChatPage;
