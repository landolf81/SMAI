import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { dmService, storageService } from '../services';
import moment from 'moment';
import 'moment/locale/ko';

// 아이콘
import MessageIcon from '@mui/icons-material/Message';
import SearchIcon from '@mui/icons-material/Search';
import PersonIcon from '@mui/icons-material/Person';

moment.locale('ko');

const DMList = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  // Supabase에서 대화 목록 조회
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => dmService.getConversations(),
    refetchInterval: 5000, // 5초마다 새로고침
  });

  // 검색 필터링
  const filteredConversations = conversations?.filter(conv =>
    conv.other_user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.other_user_username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.last_message?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // 대화 선택 핸들러 - 별도 페이지로 이동
  const handleConversationSelect = (conversation) => {
    // 읽지 않은 메시지 수 업데이트
    queryClient.invalidateQueries(['unreadCount']);
    // DM 채팅 페이지로 이동
    navigate(`/dm/${conversation.other_user_id}`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-base-100 rounded-lg shadow-sm border border-base-300">
        {/* 헤더 */}
        <div className="p-4 border-b border-base-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageIcon className="text-primary" />
              <h2 className="text-xl font-semibold text-base-content">메시지</h2>
            </div>
          </div>

          {/* 검색바 */}
          <div className="flex items-center border border-base-300 rounded-lg focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-transparent bg-base-200">
            <SearchIcon className="ml-3 flex-shrink-0 text-base-content/40" fontSize="small" />
            <input
              type="text"
              placeholder="대화 상대를 검색하세요..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 pl-2 pr-4 py-2 focus:outline-none bg-transparent text-base-content placeholder:text-base-content/40"
            />
          </div>
        </div>

        {/* 대화 목록 */}
        <div className="divide-y divide-base-300">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="loading loading-spinner loading-lg mx-auto mb-4"></div>
              <p className="text-base-content/50">대화 목록을 불러오는 중...</p>
            </div>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleConversationSelect(conversation)}
                className="p-4 hover:bg-base-200 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* 프로필 이미지 */}
                  <div className="relative">
                    <img
                      src={storageService.getProfileImageUrl(conversation.other_user_profile, conversation.other_user_id)}
                      alt={conversation.other_user_name}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => { e.target.onerror = null; e.target.src = '/default/default_profile.png'; }}
                    />
                    {/* 읽지 않은 메시지 표시 */}
                    {conversation.unread_count > 0 && (
                      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                      </div>
                    )}
                  </div>

                  {/* 대화 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-base-content truncate">
                        {conversation.other_user_name || conversation.other_user_username}
                      </h3>
                      <span className="text-xs text-base-content/50 flex-shrink-0 ml-2">
                        {moment(conversation.last_message_time).fromNow()}
                      </span>
                    </div>

                    {conversation.last_message && (
                      <p className={`text-sm truncate mt-1 ${
                        conversation.unread_count > 0
                          ? 'text-base-content font-medium'
                          : 'text-base-content/50'
                      }`}>
                        {conversation.last_message}
                      </p>
                    )}

                    {conversation.other_user_username && (
                      <p className="text-xs text-base-content/40 mt-1">
                        @{conversation.other_user_username}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : searchTerm ? (
            <div className="p-8 text-center">
              <MessageIcon className="text-base-content/20 text-4xl mb-4" />
              <p className="text-base-content/50">&apos;{searchTerm}&apos;에 대한 검색 결과가 없습니다.</p>
            </div>
          ) : (
            <div className="p-8 text-center">
              <MessageIcon className="text-base-content/20 text-6xl mb-4 mx-auto" />
              <h3 className="text-lg font-medium text-base-content mb-2">아직 메시지가 없습니다</h3>
              <p className="text-base-content/50">다른 사용자의 프로필에서 메시지를 보내보세요!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DMList;