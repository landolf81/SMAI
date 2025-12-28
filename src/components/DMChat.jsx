import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dmService } from '../services';
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
  ConversationHeader,
  Avatar,
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
  const profileUrl = conversation.other_user_profile
    ? conversation.other_user_profile.startsWith('http')
      ? conversation.other_user_profile
      : conversation.other_user_profile.startsWith('/uploads/')
        ? conversation.other_user_profile
        : `/uploads/profiles/${conversation.other_user_profile}`
    : '/default/default_profile.png';

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
      className="fixed inset-0 z-[60] bg-black bg-opacity-50"
      onClick={handleOverlayClick}
    >
      <div
        className="fixed inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:h-[90vh] md:max-h-[700px] md:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ height: '100%' }}
      >
        <MainContainer
          style={{
            borderRadius: 'inherit',
            height: '100%',
          }}
        >
          <ChatContainer>
            <ConversationHeader>
              <Avatar
                src={profileUrl}
                name={conversation.other_user_username}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/default/default_profile.png';
                }}
              />
              <ConversationHeader.Content
                userName={conversation.other_user_username || conversation.other_user_name}
                info={conversation.other_user_name && conversation.other_user_name !== conversation.other_user_username ? conversation.other_user_name : ''}
              />
              <ConversationHeader.Actions>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <CloseIcon />
                </button>
              </ConversationHeader.Actions>
            </ConversationHeader>

            <MessageList
              loading={isLoading}
              loadingMore={false}
              loadingMorePosition="top"
            >
              {Object.entries(messageGroups).map(([date, msgs]) => (
                <React.Fragment key={date}>
                  <MessageSeparator content={formatDate(date)} />
                  {msgs.map((msg) => {
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
                  })}
                </React.Fragment>
              ))}
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
