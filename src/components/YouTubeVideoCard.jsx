/**
 * YouTube 영상 카드 컴포넌트
 * 커뮤니티 피드에 YouTube 영상을 표시
 * EnhancedInstagramPost와 유사한 디자인
 */

import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { youtubeService } from '../services';

const YouTubeVideoCard = ({ video, isVisible = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const cardRef = useRef(null);

  // 화면에서 벗어나면 영상 정지
  useEffect(() => {
    if (!isVisible && isPlaying) {
      setIsPlaying(false);
      setShowPlayer(false);
    }
  }, [isVisible, isPlaying]);

  // 썸네일 클릭 시 재생
  const handlePlay = () => {
    setShowPlayer(true);
    setIsPlaying(true);
  };

  // YouTube에서 열기
  const handleOpenYouTube = (e) => {
    e.stopPropagation();
    window.open(youtubeService.getVideoUrl(video.video_id), '_blank');
  };

  // 게시 날짜 포맷
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      ref={cardRef}
      className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(255,0,0,0.15)]"
    >
      {/* 헤더 - EnhancedInstagramPost 스타일 */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* YouTube 아이콘 (프로필 이미지 스타일) */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">유튜브 영상</p>
            <p className="text-xs text-gray-500">{formatDate(video.posted_at || video.published_at)}</p>
          </div>
        </div>
        {/* 더보기 버튼 */}
        <button
          onClick={handleOpenYouTube}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          title="YouTube에서 보기"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </div>

      {/* 영상 영역 - 16:9 비율 */}
      <div className="relative bg-black aspect-video">
        {showPlayer ? (
          <iframe
            src={`${youtubeService.getEmbedUrl(video.video_id)}?autoplay=1&rel=0`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div
            className="relative w-full h-full cursor-pointer group"
            onClick={handlePlay}
          >
            {/* 썸네일 - 중앙 정렬 */}
            <img
              src={video.thumbnail_url || youtubeService.getThumbnailUrl(video.video_id, 'maxresdefault')}
              alt={video.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                // maxresdefault 실패시 hqdefault로 폴백
                e.target.src = youtubeService.getThumbnailUrl(video.video_id, 'hqdefault');
              }}
            />

            {/* 재생 버튼 오버레이 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform duration-200">
                <PlayArrowIcon className="text-white ml-1" style={{ fontSize: 40 }} />
              </div>
            </div>

            {/* YouTube 배지 */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white text-xs font-medium rounded-full shadow-lg">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
              </svg>
              YouTube
            </div>

            {/* 영상 길이 표시 */}
            {video.duration && (
              <div className="absolute bottom-3 right-3 bg-black/80 text-white text-xs px-2 py-1 rounded font-medium">
                {video.duration}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 정보 - 간결하게 */}
      <div className="px-4 py-3">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
          {video.title}
        </h3>
      </div>
    </div>
  );
};

YouTubeVideoCard.propTypes = {
  video: PropTypes.shape({
    id: PropTypes.string.isRequired,
    video_id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    thumbnail_url: PropTypes.string,
    published_at: PropTypes.string,
    posted_at: PropTypes.string,
    duration: PropTypes.string
  }).isRequired,
  isVisible: PropTypes.bool
};

export default YouTubeVideoCard;
