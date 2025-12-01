import React, { useContext, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "../context/AuthContext";
import { userService, badgeService, dmService } from "../services";
import EnhancedInstagramFeed from "../components/EnhancedInstagramFeed";
import LikedPosts from "../components/LikedPosts";
import UserComments from "../components/UserComments";
import Update from "../components/update";
import DMList from "../components/DMList";
import { useScrollRestore } from '../hooks/useScrollRestore';

// Icons
import EditIcon from "@mui/icons-material/Edit";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import AgricultureIcon from "@mui/icons-material/Agriculture";
import ArticleIcon from "@mui/icons-material/Article";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CommentIcon from "@mui/icons-material/Comment";
import MessageIcon from "@mui/icons-material/Message";

import VerifiedIcon from "@mui/icons-material/Verified";
import { BadgeList } from "../components/BadgeDisplay";
import EmailIcon from "@mui/icons-material/Email";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import LogoutIcon from "@mui/icons-material/Logout";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import DMChat from "../components/DMChat";

const Profile = () => {
  const [openUpdate, setOpenUpdate] = useState(false);
  const [activeTab, setActiveTab] = useState('posts'); // posts, likes, comments, messages
  const [updateNotification, setUpdateNotification] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [openDMChat, setOpenDMChat] = useState(false);

  const userId = useLocation().pathname.split("/")[2]; // UUID string, not integer
  const { currentUser, logout } = useContext(AuthContext);

  // 프로필 페이지 스크롤 위치 복원 (사용자 ID와 탭 고려)
  const { resetScrollPosition, scrollToTop } = useScrollRestore(
    'profile', 
    null, 
    null, 
    `${userId}_${activeTab}`
  );
  const queryClient = useQueryClient();

  // 사용자 정보 조회
  const { isPending, data, dataUpdatedAt } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => userService.getUser(userId),
    staleTime: 0, // 항상 최신 데이터 요청
    refetchOnWindowFocus: true, // 창 포커스 시 다시 가져오기
  });

  // 사용자 뱃지 조회
  const { data: badges } = useQuery({
    queryKey: ["badges", userId],
    queryFn: () => badgeService.getUserBadges(userId),
    enabled: !!userId,
  });

  // 읽지 않은 메시지 수 조회 (본인 프로필에서만)
  const { data: unreadCount } = useQuery({
    queryKey: ["unreadCount"],
    queryFn: () => dmService.getUnreadCount(),
    enabled: !!currentUser && currentUser.id === userId,
    refetchInterval: 10000, // 10초마다 갱신
  });





  // 사용자 통계 조회
  const { data: userStats = {} } = useQuery({
    queryKey: ["userStats", userId],
    queryFn: () => userService.getUserStats(userId),
    enabled: !!userId,
  });



  const handleUpdate = () => {
    setOpenUpdate(prev => {
      if (prev) {
        // 모달이 닫힐 때
        setIsUpdating(false);
      } else {
        // 모달이 열릴 때
        setIsUpdating(true);
        // 알림 상태 초기화
        setUpdateNotification('');
      }
      return !prev;
    });
  };

  // 프로필 수정 완료 콜백
  const handleUpdateComplete = () => {
    setIsUpdating(false);
    setUpdateNotification('프로필이 성공적으로 업데이트되었습니다!');
    setTimeout(() => {
      setUpdateNotification('');
    }, 3000);
    setOpenUpdate(false);
    // 즉시 데이터 새로고침
    queryClient.invalidateQueries({ queryKey: ["user", userId] });
    queryClient.invalidateQueries({ queryKey: ["posts"] }); // 게시글의 프로필 사진도 업데이트
    queryClient.invalidateQueries({ queryKey: ["enhanced-instagram-posts"] });
  };

  if (isPending) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50">
        <div className="loading loading-spinner loading-lg text-orange-500"></div>
        <p className="mt-4 text-gray-600 text-lg">프로필을 불러오는 중...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">사용자를 찾을 수 없습니다</h2>
        <p className="text-gray-600">존재하지 않는 사용자이거나 삭제된 계정입니다.</p>
      </div>
    );
  }

  const isOwnProfile = data.id === currentUser.id;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* 업데이트 알림 */}
      {updateNotification && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-bounce">
          <div className="flex items-center gap-2">
            <VerifiedIcon fontSize="small" />
            {updateNotification}
          </div>
        </div>
      )}
      
      {/* 프로필 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* 커버 이미지 및 프로필 사진 */}
          <div className="relative mb-6">
            <div
              className="h-48 rounded-xl bg-gradient-to-r from-market-100 to-produce-100 flex items-center justify-center"
              style={{
                backgroundImage: data.coverPic
                  ? `url(${data.coverPic.startsWith('http') ? data.coverPic : `/uploads/profiles/${data.coverPic}`})`
                  : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {!data.coverPic && (
                <div className="text-center">
                  <AgricultureIcon className="text-6xl text-market-500 mb-2" />
                  <p className="text-market-700 font-medium">성주참외 경락정보</p>
                </div>
              )}
            </div>

            {/* 프로필 사진 */}
            <div className="absolute -bottom-12 left-8">
              <div className="relative">
                <img
                  src={
                    data.profilePic
                      ? (data.profilePic.startsWith('http') ? data.profilePic : `/uploads/profiles/${data.profilePic}`)
                      : "/default/default_profile.png"
                  }
                  alt="프로필 사진"
                  className="w-24 h-24 rounded-full border-4 border-white shadow-lg transition-all duration-300 hover:scale-105"
                />
                {data.verified && (
                  <VerifiedIcon className="absolute -bottom-1 -right-1 text-blue-500 bg-white rounded-full" />
                )}
              </div>
            </div>
          </div>

          {/* 사용자 정보 및 액션 */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between pt-12 gap-4">
            <div className="flex-1 transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-800 transition-all duration-300">
                  {data.username || data.name}
                </h1>
                {data.name && data.name !== data.username && (
                  <span className="text-gray-600">({data.name})</span>
                )}
                
                {/* 뱃지 표시 */}
                {badges && badges.length > 0 && (
                  <div className="flex items-center ml-2">
                    <BadgeList 
                      badges={badges} 
                      size="sm" 
                      maxDisplay={5}
                      className="gap-1"
                    />
                  </div>
                )}
              </div>
              
              {data.bio && (
                <p className="text-gray-700 mb-3 max-w-2xl transition-all duration-300">
                  {data.bio}
                </p>
              )}
              
              <div className="flex items-center gap-6 text-sm text-gray-600">
                {data.location && (
                  <div className="flex items-center gap-1">
                    <LocationOnIcon fontSize="small" />
                    <span>{data.location}</span>
                  </div>
                )}
                {data.email && (
                  <div className="flex items-center gap-1">
                    <EmailIcon fontSize="small" />
                    <span>{data.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <CalendarTodayIcon fontSize="small" />
                  <span>가입일: {(data.created_at || data.createdAt) ? new Date(data.created_at || data.createdAt).toLocaleDateString('ko-KR') : '알 수 없음'}</span>
                </div>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex flex-col gap-2 w-full md:w-auto">
              {isOwnProfile ? (
                <>
                  <button
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className={`flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl hover:from-green-600 hover:to-green-700 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                      isUpdating ? 'animate-pulse' : ''
                    }`}
                  >
                    <EditIcon className="w-5 h-5" />
                    <span className="font-semibold text-base">{isUpdating ? '업데이트 중...' : '프로필 편집'}</span>
                  </button>
                  <button
                    onClick={logout}
                    className="flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-2xl hover:from-gray-600 hover:to-gray-700 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    <LogoutIcon className="w-5 h-5" />
                    <span className="font-semibold text-base">로그아웃</span>
                  </button>
                </>
              ) : currentUser ? (
                <>
                  <button 
                    onClick={() => setOpenDMChat(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:from-blue-600 hover:to-blue-700 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    <MailOutlineIcon className="w-5 h-5" />
                    <span className="font-semibold">메시지</span>
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t">
            <div className="text-center">
              <div className="text-xl font-bold text-gray-800">{userStats.posts || 0}</div>
              <div className="text-sm text-gray-600">게시물</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-800">{userStats.comments || 0}</div>
              <div className="text-sm text-gray-600">댓글</div>
            </div>
          </div>
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 탭 네비게이션 */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('posts')}
                className={`flex items-center justify-center px-4 py-3 font-medium ${
                  activeTab === 'posts'
                    ? 'text-market-600 border-b-2 border-market-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="게시물"
              >
                <ArticleIcon fontSize="small" />
              </button>
              <button
                onClick={() => setActiveTab('likes')}
                className={`flex items-center justify-center px-4 py-3 font-medium ${
                  activeTab === 'likes'
                    ? 'text-market-600 border-b-2 border-market-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="좋아요"
              >
                <FavoriteIcon fontSize="small" />
              </button>
              <button
                onClick={() => setActiveTab('comments')}
                className={`flex items-center justify-center px-4 py-3 font-medium ${
                  activeTab === 'comments'
                    ? 'text-market-600 border-b-2 border-market-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="댓글"
              >
                <CommentIcon fontSize="small" />
              </button>
              
              {/* 메시지 탭 (본인 프로필에서만 표시) */}
              {currentUser && currentUser.id === userId && (
                <button
                  onClick={() => setActiveTab('messages')}
                  className={`flex items-center justify-center px-4 py-3 font-medium relative ${
                    activeTab === 'messages'
                      ? 'text-market-600 border-b-2 border-market-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="메시지"
                >
                  <MessageIcon fontSize="small" />
                  {/* 읽지 않은 메시지 수 배지 */}
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              )}
            </nav>
          </div>

          {/* 탭 콘텐츠 */}
          <div className="p-6">
            {activeTab === 'posts' && (
              <EnhancedInstagramFeed userId={userId} />
            )}
            {activeTab === 'likes' && (
              <LikedPosts userId={userId} />
            )}
            {activeTab === 'comments' && (
              <UserComments userId={userId} />
            )}
            {activeTab === 'messages' && currentUser && currentUser.id === userId && (
              <DMList />
            )}
          </div>
        </div>
      </div>

      {/* 프로필 수정 모달 */}
      {openUpdate && (
        <Update 
          setOpenUpdate={setOpenUpdate} 
          user={data} 
          onUpdateComplete={handleUpdateComplete}
          isUpdating={isUpdating}
          setIsUpdating={setIsUpdating}
        />
      )}
      
      {/* DM 채팅 창 */}
      {openDMChat && data && currentUser && currentUser.id !== userId && (
        <DMChat
          conversation={{
            other_user_id: data.id,
            other_user_username: data.username,
            other_user_name: data.name,
            other_user_profile: data.profilePic
          }}
          onClose={() => setOpenDMChat(false)}
        />
      )}
    </div>
  );
};

export default Profile;
