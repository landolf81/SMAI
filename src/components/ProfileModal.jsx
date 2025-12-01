import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PersonIcon from '@mui/icons-material/Person';
import CloseIcon from '@mui/icons-material/Close';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import BadgeDisplay from './BadgeDisplay';
import DMChat from './DMChat';
import { badgeService, userService } from '../services';
import { AuthContext } from '../context/AuthContext';

const ProfileModal = ({ isOpen, onClose, user }) => {
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const [showDMChat, setShowDMChat] = useState(false);

  const userId = user?.userId || user?.user_id || user?.id;

  // 사용자 전체 정보 조회 (커버 이미지 포함)
  const { data: fullUserData, isLoading: isLoadingUser } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userService.getUser(userId),
    enabled: isOpen && !!userId,
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    gcTime: 10 * 60 * 1000, // 10분간 메모리 유지 (구 cacheTime)
  });

  // 사용자 뱃지 조회
  const { data: userBadges = [], isLoading: isLoadingBadges } = useQuery({
    queryKey: ['user-badges', userId],
    queryFn: () => badgeService.getUserBadges(userId),
    enabled: isOpen && !!userId,
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    gcTime: 10 * 60 * 1000,
  });

  // 전체 정보가 있으면 사용, 없으면 기본 user 객체 사용
  const displayUser = fullUserData || user;
  const isLoading = isLoadingUser || isLoadingBadges;

  // 모달 열릴 때 배경 스크롤 막기
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleViewProfile = () => {
    navigate(`/profile/${user.userId || user.user_id || user.id}`);
    onClose();
  };

  // 프로필 이미지 URL 처리
  const getProfileImageUrl = () => {
    const pic = displayUser.profilePic || displayUser.profile_pic;
    if (!pic) return null;

    // 이미 전체 경로인 경우 (http:// 또는 https://로 시작)
    if (pic.startsWith('http://') || pic.startsWith('https://')) {
      return pic;
    }

    // 상대 경로인 경우
    if (pic.startsWith('/uploads/')) {
      return pic;
    }

    // 파일명만 있는 경우
    return `/uploads/profiles/${pic}`;
  };

  // 커버 이미지 URL 처리
  const getCoverImageUrl = () => {
    const cover = displayUser.coverPic || displayUser.cover_pic;
    if (!cover) return null;

    // 이미 전체 경로인 경우 (http:// 또는 https://로 시작)
    if (cover.startsWith('http://') || cover.startsWith('https://')) {
      return cover;
    }

    // 상대 경로인 경우
    if (cover.startsWith('/uploads/')) {
      return cover;
    }

    // 파일명만 있는 경우
    return `/uploads/profiles/${cover}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-gray-200 z-10 bg-black bg-opacity-30 rounded-full p-1"
        >
          <CloseIcon />
        </button>

        {/* 커버 이미지 */}
        <div
          className="h-32 bg-gradient-to-r from-orange-100 to-orange-200 flex items-center justify-center"
          style={{
            backgroundImage: getCoverImageUrl() ? `url(${getCoverImageUrl()})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {!getCoverImageUrl() && (
            <div className="text-center opacity-50">
              <PersonIcon className="text-6xl text-orange-400" />
            </div>
          )}
        </div>

        {/* 프로필 정보 */}
        <div className="flex flex-col items-center px-6 pb-6">
          {/* 로딩 중일 때 전체 로딩 표시 */}
          {isLoading ? (
            <div className="py-8 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-gray-200 border-4 border-white shadow-lg -mt-12 mb-4 flex items-center justify-center">
                <div className="loading loading-spinner loading-md text-orange-500"></div>
              </div>
              <p className="text-gray-500 text-sm">프로필을 불러오는 중...</p>
            </div>
          ) : (
            <>
              {/* 프로필 사진 - 커버 이미지와 겹치도록 음수 마진 */}
              <div className="-mt-12 mb-4">
                {getProfileImageUrl() ? (
                  <img
                    src={getProfileImageUrl()}
                    alt={displayUser.name || displayUser.username}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-4 border-white shadow-lg"
                  style={{ display: getProfileImageUrl() ? 'none' : 'flex' }}
                >
                  <PersonIcon className="text-gray-500" sx={{ fontSize: 48 }} />
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-gray-900">
                  {displayUser.name || displayUser.user_name || displayUser.username}
                </h2>
                {/* DM 아이콘 - 본인이 아닌 경우에만 표시 */}
                {currentUser && currentUser.id !== userId && (
                  <button
                    onClick={() => setShowDMChat(true)}
                    className="text-blue-500 hover:text-blue-600 transition-colors p-1 rounded-full hover:bg-blue-50"
                    title="메시지 보내기"
                  >
                    <MailOutlineIcon fontSize="small" />
                  </button>
                )}
              </div>

              {displayUser.username && displayUser.name && (
                <p className="text-sm text-gray-500 text-center mb-4">@{displayUser.username}</p>
              )}
            </>
          )}

          {/* 뱃지 표시 - @id 아래에 배치 */}
          {!isLoading && userBadges && userBadges.length > 0 && (
            <div className="flex items-center justify-center gap-1 flex-wrap mt-2 mb-4">
              {userBadges.map((badge, index) => (
                <BadgeDisplay
                  key={badge.id || index}
                  badge={badge}
                  size="sm"
                />
              ))}
            </div>
          )}

          {/* 버튼 영역 */}
          {!isLoading && (
            <div className="w-full">
              {/* 프로필 보기 버튼 */}
              <button
                onClick={handleViewProfile}
                className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                프로필 보기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DM 채팅 모달 */}
      {showDMChat && displayUser && (
        <DMChat
          conversation={{
            other_user_id: userId,
            other_user_username: displayUser.username,
            other_user_name: displayUser.name || displayUser.user_name,
            other_user_profile: displayUser.profilePic || displayUser.profile_pic
          }}
          onClose={() => setShowDMChat(false)}
        />
      )}
    </div>
  );
};

export default ProfileModal;
