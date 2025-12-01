import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userService } from '../services';
import CommentIcon from '@mui/icons-material/Comment';
import PersonIcon from '@mui/icons-material/Person';
import ArticleIcon from '@mui/icons-material/Article';
import PostDetailModal from './PostDetailModal';

const UserComments = ({ userId }) => {
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  // 사용자 댓글 내역 조회
  const { data: userComments, isLoading, error } = useQuery({
    queryKey: ['userComments', userId],
    queryFn: () => userService.getUserComments(userId),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading loading-spinner loading-lg text-primary"></div>
        <span className="ml-3">댓글 내역을 불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-2">댓글 내역을 불러오는데 실패했습니다</div>
        <div className="text-gray-500 text-sm">{error.message}</div>
      </div>
    );
  }

  if (!userComments || userComments.length === 0) {
    return (
      <div className="text-center py-12">
        <CommentIcon className="text-6xl text-gray-300 mb-4" />
        <p className="text-gray-500">작성한 댓글이 없습니다</p>
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
        {userComments.map((comment) => (
          <div
            key={comment.id}
            className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer"
            onClick={() => comment.post?.id && handlePostClick(comment.post.id)}
          >
            <div className="space-y-3">
              {/* 댓글 헤더 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CommentIcon className="text-blue-500" fontSize="small" />
                  <span className="text-sm font-medium text-gray-900">댓글</span>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <ArticleIcon className="text-gray-400" fontSize="small" />
              </div>

              {/* 댓글 내용 */}
              <div className="bg-white rounded-lg p-3 border-l-4 border-blue-500">
                <p className="text-gray-700 text-sm mb-2">
                  {comment.description || comment.desc}
                </p>
              </div>

              {/* 원본 게시물 정보 */}
              {comment.post && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <PersonIcon className="text-gray-400" fontSize="small" />
                    <span className="text-xs font-medium text-gray-600">
                      {comment.post.username || comment.post.name}의 게시물
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs line-clamp-2">
                    {comment.post.description || comment.post.desc || comment.post.content}
                  </p>
                </div>
              )}
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

export default UserComments;