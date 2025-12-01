import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userService } from '../services';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CommentIcon from '@mui/icons-material/Comment';
import PersonIcon from '@mui/icons-material/Person';
import PostDetailModal from './PostDetailModal';

const LikedPosts = ({ userId }) => {
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  // 좋아요한 게시물 조회
  const { data: likedPosts, isLoading, error } = useQuery({
    queryKey: ['likedPosts', userId],
    queryFn: () => userService.getUserLikedPosts(userId),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading loading-spinner loading-lg text-primary"></div>
        <span className="ml-3">좋아요한 게시물을 불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-2">게시물을 불러오는데 실패했습니다</div>
        <div className="text-gray-500 text-sm">{error.message}</div>
      </div>
    );
  }

  if (!likedPosts || likedPosts.length === 0) {
    return (
      <div className="text-center py-12">
        <FavoriteIcon className="text-6xl text-gray-300 mb-4" />
        <p className="text-gray-500">좋아요한 게시물이 없습니다</p>
      </div>
    );
  }

  const handlePostClick = (postId) => {
    setSelectedPostId(postId);
    setShowModal(true);
  };

  return (
    <>
      <div className="space-y-4">
        {likedPosts.map((post) => (
          <div
            key={post.id}
            className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer"
            onClick={() => handlePostClick(post.id)}
          >
            <div className="flex items-start space-x-3">
              {/* 게시물 이미지 (있는 경우) */}
              {post.img && (
                <div className="flex-shrink-0">
                  <img
                    src={post.img}
                    alt="게시물 이미지"
                    className="w-16 h-16 object-cover rounded-lg"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              {/* 게시물 내용 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  {post.user && (
                    <>
                      <PersonIcon className="text-gray-400" fontSize="small" />
                      <span className="text-sm font-medium text-gray-900">
                        {post.user.name || post.user.username}
                      </span>
                    </>
                  )}
                  <span className="text-xs text-gray-500">
                    {new Date(post.created_at || post.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>

                <p className="text-gray-700 text-sm line-clamp-2 mb-2">
                  {post.description || post.desc || post.content}
                </p>

                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  {post.liked_at && (
                    <span className="text-red-500">
                      ❤️ {new Date(post.liked_at).toLocaleDateString('ko-KR')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 게시물 상세 모달 */}
      <PostDetailModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedPostId(null);
        }}
        postId={selectedPostId}
      />
    </>
  );
};

export default LikedPosts;