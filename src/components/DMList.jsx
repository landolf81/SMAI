import React, { useState, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { dmService } from '../services';
import moment from 'moment';
import 'moment/locale/ko';
import DMChat from './DMChat';

// 아이콘
import MessageIcon from '@mui/icons-material/Message';
import SearchIcon from '@mui/icons-material/Search';
import PersonIcon from '@mui/icons-material/Person';

moment.locale('ko');

const DMList = () => {
  const { currentUser } = useContext(AuthContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
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

  // 대화 선택 핸들러
  const handleConversationSelect = (conversation) => {
    setSelectedConversation({
      id: conversation.id,
      other_user_id: conversation.other_user_id,
      other_user_name: conversation.other_user_name,
      other_user_username: conversation.other_user_username,
      other_user_profile: conversation.other_user_profile
    });
    
    // 읽지 않은 메시지 수 업데이트
    queryClient.invalidateQueries(['unreadCount']);
  };

  if (selectedConversation) {
    return (
      <DMChat
        conversation={selectedConversation}
        onClose={() => setSelectedConversation(null)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border">
        {/* 헤더 */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageIcon className="text-market-600" />
              <h2 className="text-xl font-semibold text-gray-900">메시지</h2>
            </div>
          </div>
          
          {/* 검색바 */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fontSize="small" />
            <input
              type="text"
              placeholder="대화 상대를 검색하세요..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-market-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 대화 목록 */}
        <div className="divide-y">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="loading loading-spinner loading-lg mx-auto mb-4"></div>
              <p className="text-gray-500">대화 목록을 불러오는 중...</p>
            </div>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleConversationSelect(conversation)}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* 프로필 이미지 */}
                  <div className="relative">
                    {conversation.other_user_profile ? (
                      <img
                        src={conversation.other_user_profile}
                        alt={conversation.other_user_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                        <PersonIcon className="text-gray-500" />
                      </div>
                    )}
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
                      <h3 className="font-medium text-gray-900 truncate">
                        {conversation.other_user_name || conversation.other_user_username}
                      </h3>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                        {moment(conversation.last_message_time).fromNow()}
                      </span>
                    </div>
                    
                    {conversation.last_message && (
                      <p className={`text-sm truncate mt-1 ${
                        conversation.unread_count > 0 
                          ? 'text-gray-900 font-medium' 
                          : 'text-gray-500'
                      }`}>
                        {conversation.last_message}
                      </p>
                    )}
                    
                    {conversation.other_user_username && (
                      <p className="text-xs text-gray-400 mt-1">
                        @{conversation.other_user_username}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : searchTerm ? (
            <div className="p-8 text-center">
              <MessageIcon className="text-gray-300 text-4xl mb-4" />
              <p className="text-gray-500">'{searchTerm}'에 대한 검색 결과가 없습니다.</p>
            </div>
          ) : (
            <div className="p-8 text-center">
              <MessageIcon className="text-gray-300 text-6xl mb-4 mx-auto" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">아직 메시지가 없습니다</h3>
              <p className="text-gray-500">다른 사용자의 프로필에서 메시지를 보내보세요!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DMList;