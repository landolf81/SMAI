import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dmService } from '../services';
import { AuthContext } from '../context/AuthContext';
import moment from 'moment';
import 'moment/locale/ko';

// 아이콘
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';

moment.locale('ko');

const DMChat = ({ conversation, onClose }) => {
  const { currentUser } = useContext(AuthContext);
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState(conversation.id);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  // 대화 ID는 상대방 사용자 ID를 사용
  useEffect(() => {
    if (conversation.other_user_id) {
      setConversationId(conversation.other_user_id);
    }
  }, [conversation]);

  // DM 창이 열릴 때 모든 메시지를 읽음으로 표시
  useEffect(() => {
    if (conversationId) {
      dmService.markAllAsReadFromUser(conversationId).then(() => {
        // 읽음 처리 후 관련 쿼리 무효화
        queryClient.invalidateQueries(['conversations']);
        queryClient.invalidateQueries(['unreadCount']);
      });
    }
  }, [conversationId, queryClient]);

  // Supabase에서 메시지 목록 조회
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => dmService.getMessages(conversationId),
    enabled: !!conversationId,
    refetchInterval: 3000 // 3초마다 새로고침
  });

  // 메시지 전송 뮤테이션
  const sendMessageMutation = useMutation({
    mutationFn: (messageData) =>
      dmService.sendMessage({
        receiverId: conversationId,
        content: messageData.content
      }),
    onSuccess: () => {
      // 메시지 목록 새로고침
      queryClient.invalidateQueries(['messages', conversationId]);
      queryClient.invalidateQueries(['conversations']);
      queryClient.invalidateQueries(['unreadCount']);
      setMessage('');
    },
    onError: (error) => {
      console.error('메시지 전송 실패:', error);
      alert('메시지 전송에 실패했습니다.');
    }
  });

  // 메시지 삭제 뮤테이션
  const deleteMessageMutation = useMutation({
    mutationFn: (messageId) => dmService.deleteMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages', conversationId]);
    },
    onError: (error) => {
      console.error('메시지 삭제 실패:', error);
      alert('메시지 삭제에 실패했습니다.');
    }
  });

  // 메시지 전송 핸들러
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessageMutation.mutate({
        content: message
      });
    }
  };

  // 메시지 삭제 핸들러
  const handleDeleteMessage = (messageId) => {
    if (window.confirm('이 메시지를 삭제하시겠습니까?')) {
      deleteMessageMutation.mutate(messageId);
    }
  };

  // 스크롤 하단으로 이동
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 메시지가 업데이트될 때마다 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 컴포넌트 마운트 시 입력 필드 포커스, 배경 스크롤 방지, 하단 메뉴 숨기기
  useEffect(() => {
    inputRef.current?.focus();

    // 배경 스크롤 방지
    document.body.style.overflow = 'hidden';
    // 하단 메뉴 숨기기 (data-dm-open 속성 추가)
    document.body.setAttribute('data-dm-open', 'true');

    return () => {
      // 컴포넌트 언마운트 시 복원
      document.body.style.overflow = '';
      document.body.removeAttribute('data-dm-open');
    };
  }, []);

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

  // 오버레이 클릭 핸들러 (모달 외부 클릭 시에만 닫기)
  const handleOverlayClick = useCallback((e) => {
    // 오버레이 자체를 클릭했을 때만 닫기 (모달 내부 클릭은 무시)
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black bg-opacity-50"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white shadow-xl w-full h-full flex flex-col absolute inset-0 md:relative md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:h-[90vh] md:max-h-[700px] md:max-w-2xl md:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-center space-x-3">
            <img
              src={
                conversation.other_user_profile
                  ? conversation.other_user_profile.startsWith('http')
                    ? conversation.other_user_profile
                    : conversation.other_user_profile.startsWith('/uploads/')
                      ? conversation.other_user_profile
                      : `/uploads/profiles/${conversation.other_user_profile}`
                  : '/default/default_profile.png'
              }
              alt={conversation.other_user_username}
              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/default/default_profile.png';
              }}
            />
            <div>
              <p className="font-semibold text-gray-900">
                {conversation.other_user_username || conversation.other_user_name}
              </p>
              <p className="text-xs text-gray-500">
                {conversation.other_user_name && conversation.other_user_name !== conversation.other_user_username && (
                  <span>{conversation.other_user_name}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 bg-gray-50">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="loading loading-spinner loading-md"></div>
            </div>
          ) : messages.length > 0 ? (
            <div className="space-y-2">
              {Object.entries(messageGroups).map(([date, msgs]) => (
                <div key={date}>
                  {/* 날짜 구분선 */}
                  <div className="flex items-center justify-center my-2">
                    <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                      {moment(date).calendar(null, {
                        sameDay: '오늘',
                        lastDay: '어제',
                        lastWeek: 'M월 D일',
                        sameElse: 'YYYY년 M월 D일'
                      })}
                    </div>
                  </div>

                  {/* 메시지들 */}
                  {msgs.map((msg) => {
                    const isMyMessage = msg.sender_id === currentUser.id;

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`group relative max-w-md ${isMyMessage ? 'items-end' : 'items-start'}`}>
                          {/* 메시지 버블 */}
                          <div
                            className={`px-4 py-2 rounded-lg shadow ${
                              isMyMessage
                                ? 'bg-green-500 text-white'
                                : 'bg-white text-gray-900 border'
                            }`}
                          >
                            {/* 텍스트 메시지 */}
                            {msg.content && msg.content.trim() && (
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            )}
                            <div className={`flex items-center space-x-2 mt-1 ${
                              isMyMessage ? 'justify-end' : 'justify-start'
                            }`}>
                              <span className={`text-xs ${
                                isMyMessage ? 'text-green-100' : 'text-gray-500'
                              }`}>
                                {moment(msg.created_at).format('HH:mm')}
                              </span>
                              {msg.is_edited && (
                                <span className={`text-xs ${
                                  isMyMessage ? 'text-green-100' : 'text-gray-500'
                                }`}>
                                  (수정됨)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 삭제 버튼 (본인 메시지만) */}
                          {isMyMessage && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-1 transition-opacity"
                            >
                              <DeleteIcon fontSize="small" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p className="text-lg">💬 새로운 대화</p>
              <p className="text-sm mt-2">대화를 시작해보세요!</p>
            </div>
          )}
        </div>

        {/* 입력 영역 */}
        <form
          onSubmit={handleSendMessage}
          className="p-2 sm:p-3 border-t bg-white flex-shrink-0"
        >
          <div className="flex items-end space-x-2">
            {/* 메시지 입력 */}
            <div className="flex-1">
              <textarea
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="메시지를 입력하세요..."
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                rows="1"
                style={{ minHeight: '40px', maxHeight: '120px' }}
              />
            </div>

            {/* 전송 버튼 */}
            <button
              type="submit"
              disabled={!message.trim() || sendMessageMutation.isPending}
              className={`p-2 rounded-lg transition-colors ${
                message.trim()
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {sendMessageMutation.isPending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <SendIcon />
              )}
            </button>
          </div>

          {/* 안내 텍스트 */}
          <p className="text-xs text-gray-500 mt-1">
            Enter로 전송, Shift+Enter로 줄바꿈
          </p>
        </form>
      </div>
    </div>
  );
};

export default DMChat;
