import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { postService, adService } from '../services';
import EnhancedInstagramPost from './EnhancedInstagramPost';
import MobileAdDisplay from './MobileAdDisplay';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import LoadingSpinner from './LoadingSpinner';
import { shouldShowAds } from '../utils/deviceDetector';

const SavedPosts = ({ userId }) => {
  // 저장된 게시물 조회
  const { data: savedPosts, isLoading, error } = useQuery({
    queryKey: ['savedPosts', userId],
    queryFn: () => postService.getSavedPosts(userId),
    enabled: !!userId,
  });

  // 광고 데이터 가져오기 (모바일에서만)
  const { data: adsData } = useQuery({
    queryKey: ['ads', 'active'],
    queryFn: async () => {
      if (!shouldShowAds()) return [];
      const ads = await adService.getActiveAds();
      return ads || [];
    },
    staleTime: 10 * 60 * 1000,
    enabled: shouldShowAds(),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center py-12">
        <LoadingSpinner size="lg" />
        <span className="mt-4 text-gray-600">저장된 게시물을 불러오는 중...</span>
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

  if (!savedPosts || savedPosts.length === 0) {
    return (
      <div className="text-center py-12">
        <BookmarkIcon className="text-6xl text-gray-300 mb-4" sx={{ fontSize: 64 }} />
        <p className="text-gray-500">저장된 게시물이 없습니다</p>
        <p className="text-sm text-gray-400 mt-2">게시물의 북마크 아이콘을 눌러 저장해보세요</p>
      </div>
    );
  }

  const ads = adsData || [];

  return (
    <div className="space-y-4">
      {savedPosts.map((post, index) => (
        <React.Fragment key={post.id}>
          <EnhancedInstagramPost
            post={{
              ...post,
              // 필드 매핑
              Desc: post.description || post.desc || post.content,
              desc: post.description || post.desc || post.content,
              img: post.photo || post.img,
              profilePic: post.users?.profile_pic || post.user?.profile_pic || post.profilePic,
              username: post.users?.username || post.user?.username || post.username,
              name: post.users?.name || post.user?.name || post.name,
              user: post.users || post.user,
              userId: post.user_id || post.userId,
              createdAt: post.created_at || post.createdAt,
            }}
            isVisible={true}
            disableAutoplay={true}
          />
          {/* 3개마다 광고 삽입 */}
          {(index + 1) % 3 === 0 && ads.length > 0 && (
            <MobileAdDisplay ad={ads[Math.floor(index / 3) % ads.length]} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default SavedPosts;
