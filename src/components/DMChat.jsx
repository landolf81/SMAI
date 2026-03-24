import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dmService, storageService } from '../services';
import { AuthContext } from '../context/AuthContext';
import moment from 'moment';
import 'moment/locale/ko';

// Chatscope
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  MessageSeparator,
} from '@chatscope/chat-ui-kit-react';

// 아이콘
import CloseIcon from '@mui/icons-material/Close';

moment.locale('ko');

const DMChat = ({ conversation, onClose }) => {
  const { currentUser } = useContext(AuthContext);
  const [conversationId, setConversationId] = useState(conversation.id);
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
    refetchInterval: 3000
  });

  // 메시지 전송 뮤테이션
  const sendMessageMutation = useMutation({
    mutationFn: (messageData) =>
      dmService.sendMessage({
        receiverId: conversationId,
        content: messageData.content
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages', conversationId]);
      queryClient.invalidateQueries(['conversations']);
      queryClient.invalidateQueries(['unreadCount']);
    },
    onError: (error) => {
      console.error('메시지 전송 실패:', error);
      alert('메시지 전송에 실패했습니다.');
    }
  });

  // 메시지 전송 핸들러
  const handleSend = (text) => {
    if (text.trim()) {
      sendMessageMutation.mutate({ content: text });
    }
  };

  // 컴포넌트 마운트 시 배경 스크롤 방지
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-dm-open', 'true');

    return () => {
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

  // 오버레이 클릭 핸들러
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // 프로필 이미지 URL
  const profileUrl = storageService.getProfileImageUrl(
    conversation.other_user_profile,
    conversation.other_user_id
  );

  // 날짜 포맷
  const formatDate = (date) => {
    return moment(date).calendar(null, {
      sameDay: '오늘',
      lastDay: '어제',
      lastWeek: 'M월 D일',
      sameElse: 'YYYY년 M월 D일'
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      <div
        className="w-full h-full md:w-full md:max-w-2xl md:h-[90vh] md:max-h-[700px] md:rounded-2xl overflow-hidden bg-base-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 커스텀 헤더 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-base-300 bg-base-100 flex-shrink-0">
          <img
            src={profileUrl}
            alt={conversation.other_user_name}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            onError={(e) => { e.target.onerror = null; e.target.src = '/default/default_profile.png'; }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base-content truncate">
              {conversation.other_user_name || conversation.other_user_username}
            </p>
            {conversation.other_user_username && conversation.other_user_username !== conversation.other_user_name && (
              <p className="text-xs text-base-content/50 truncate">@{conversation.other_user_username}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-base-content/50 hover:text-base-content hover:bg-base-200 rounded-full transition-colors flex-shrink-0"
          >
            <CloseIcon />
          </button>
        </div>

        <MainContainer
          style={{
            borderRadius: 'inherit',
            flex: 1,
            minHeight: 0,
          }}
        >
          <ChatContainer>

            <MessageList
              loading={isLoading}
              loadingMore={false}
              loadingMorePosition="top"
            >
              {Object.entries(messageGroups).flatMap(([date, msgs]) => [
                <MessageSeparator key={`sep-${date}`} content={formatDate(date)} />,
                ...msgs.map((msg) => {
                  const isMyMessage = msg.sender_id === currentUser.id;
                  return (
                    <Message
                      key={msg.id}
                      model={{
                        message: msg.content,
                        sentTime: moment(msg.created_at).format('HH:mm'),
                        direction: isMyMessage ? 'outgoing' : 'incoming',
                        position: 'single',
                      }}
                    >
                      <Message.Footer
                        sentTime={moment(msg.created_at).format('HH:mm')}
                      />
                    </Message>
                  );
                })
              ])}
            </MessageList>

            <MessageInput
              placeholder="메시지를 입력하세요..."
              onSend={handleSend}
              attachButton={false}
              autoFocus
            />
          </ChatContainer>
        </MainContainer>
      </div>
    </div>
  );
};

export default DMChat;
