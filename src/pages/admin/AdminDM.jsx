/**
 * AdminDM.jsx
 *
 * 역할: 관리자가 특정 사용자에게 DM을 직접 발송하는 페이지
 * - 사용자명/이름으로 수신자 검색
 * - dmService.sendMessage() 호출로 메시지 전송
 */

import { useState, useRef } from 'react';
import SendIcon from '@mui/icons-material/Send';
import SearchIcon from '@mui/icons-material/Search';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { AdminOnly } from '../../components/PermissionComponents';
import { userService } from '../../services';
import { dmService } from '../../services/dmService';

const AdminDM = () => {
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentHistory, setSentHistory] = useState([]);
  const searchTimerRef = useRef(null);

  // 사용자 검색 (디바운스 300ms)
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);

    clearTimeout(searchTimerRef.current);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const result = await userService.getUsers({ search: val.trim(), limit: 10 });
        setSearchResults(result?.users ?? result ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchInput('');
    setSearchResults([]);
    setMessage('');
  };

  const handleClearUser = () => {
    setSelectedUser(null);
    setMessage('');
  };

  const handleSend = async () => {
    if (!selectedUser || !message.trim()) return;
    setSending(true);
    try {
      await dmService.sendMessage({
        receiverId: selectedUser.id,
        content: message.trim(),
      });
      setSentHistory(prev => [{
        userId: selectedUser.id,
        userName: selectedUser.name || selectedUser.username,
        userProfile: selectedUser.profile_pic,
        content: message.trim(),
        sentAt: new Date().toISOString(),
      }, ...prev]);
      setMessage('');
    } catch (err) {
      alert(err.message || 'DM 전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminOnly>
      <div className="p-6 pt-20 max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[#004225] rounded-xl flex items-center justify-center">
            <ChatIcon className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">관리자 DM 발송</h1>
            <p className="text-gray-500 text-sm">사용자를 검색하여 직접 메시지를 보냅니다</p>
          </div>
        </div>

        {/* 수신자 선택 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">수신자</h2>

          {selectedUser ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
              <img
                src={selectedUser.profile_pic || '/default/default_profile.png'}
                alt="프로필"
                className="w-10 h-10 rounded-full object-cover border border-gray-200"
                onError={(e) => { e.target.src = '/default/default_profile.png'; }}
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{selectedUser.name || '-'}</p>
                <p className="text-xs text-gray-500">@{selectedUser.username || '-'}</p>
              </div>
              <button
                onClick={handleClearUser}
                className="p-1.5 hover:bg-green-100 rounded-lg transition-colors"
                title="수신자 변경"
              >
                <CloseIcon fontSize="small" className="text-gray-500" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fontSize="small" />
              <input
                type="text"
                value={searchInput}
                onChange={handleSearchChange}
                placeholder="사용자명 또는 이름으로 검색..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004225] focus:border-transparent"
              />

              {/* 검색 결과 드롭다운 */}
              {(searchResults.length > 0 || searchLoading) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                  {searchLoading ? (
                    <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-[#004225] rounded-full animate-spin" />
                      검색 중...
                    </div>
                  ) : (
                    searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        <img
                          src={user.profile_pic || '/default/default_profile.png'}
                          alt="프로필"
                          className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
                          onError={(e) => { e.target.src = '/default/default_profile.png'; }}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.name || '-'}</p>
                          <p className="text-xs text-gray-500">@{user.username || '-'}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 메시지 작성 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">메시지 내용</h2>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={selectedUser ? `${selectedUser.name || selectedUser.username}님께 보낼 메시지를 입력하세요...` : '먼저 수신자를 선택해주세요'}
            disabled={!selectedUser}
            rows={5}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#004225] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-400">{message.length}자</p>
            <button
              onClick={handleSend}
              disabled={!selectedUser || !message.trim() || sending}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#004225] hover:bg-[#003018] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  전송 중...
                </>
              ) : (
                <>
                  <SendIcon fontSize="small" />
                  DM 전송
                </>
              )}
            </button>
          </div>
        </div>

        {/* 발송 이력 */}
        {sentHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">이번 세션 발송 이력</h2>
            <div className="space-y-3">
              {sentHistory.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <img
                    src={item.userProfile || '/default/default_profile.png'}
                    alt="프로필"
                    className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0 mt-0.5"
                    onError={(e) => { e.target.src = '/default/default_profile.png'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-gray-700">{item.userName}</p>
                      <CheckCircleIcon className="text-green-500" style={{ fontSize: 14 }} />
                      <p className="text-xs text-gray-400 ml-auto">
                        {new Date(item.sentAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{item.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminOnly>
  );
};

export default AdminDM;
