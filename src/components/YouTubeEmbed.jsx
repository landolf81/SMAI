import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { getYouTubeVideoId, getYouTubeThumbnail, getYouTubeEmbedUrl } from '../utils/linkDetector';

/**
 * YouTube 동영상 임베드 컴포넌트
 * 인스타그램 스타일의 깔끔한 디자인
 */
const YouTubeEmbed = ({ 
  url, 
  autoplay = false, 
  showThumbnail = true,
  className = "",
  onPlay,
  onError,
  forceAutoplay = false // 강제 자동재생 옵션 (권장하지 않음)
}) => {
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [embedError, setEmbedError] = useState(false);

  const videoId = getYouTubeVideoId(url);
  
  if (!videoId) {
    return (
      <div className="flex items-center justify-center p-4 bg-gray-100 rounded-lg">
        <p className="text-gray-500 text-sm">유효하지 않은 YouTube 링크입니다</p>
      </div>
    );
  }

  const thumbnailUrl = getYouTubeThumbnail(videoId, 'hqdefault');
  const embedUrl = getYouTubeEmbedUrl(videoId, {
    autoplay: isPlaying,
    mute: true,
    controls: true,
    showRelated: false
  });

  const handlePlay = () => {
    setIsPlaying(true);
    onPlay && onPlay(videoId);
  };

  const handleThumbnailError = () => {
    setThumbnailError(true);
  };

  const handleEmbedError = () => {
    setEmbedError(true);
    onError && onError('embed_failed');
  };

  const openInYouTube = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // 임베드가 활성화된 경우
  if (isPlaying && !embedError) {
    return (
      <div className={`relative w-full rounded-lg overflow-hidden bg-black ${className}`} style={{ aspectRatio: '16/9' }}>
        <iframe
          src={embedUrl}
          className="w-full h-full"
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onError={handleEmbedError}
        />
        
        {/* YouTube에서 열기 버튼 */}
        <button
          onClick={openInYouTube}
          className="absolute top-3 right-3 bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-2 rounded-full transition-all duration-200 z-10"
          title="YouTube에서 열기"
        >
          <FontAwesomeIcon icon={faExternalLinkAlt} className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // 썸네일 표시 (기본 상태)
  return (
    <div className={`relative w-full rounded-lg overflow-hidden bg-gray-900 cursor-pointer group ${className}`} style={{ aspectRatio: '16/9' }}>
      {!thumbnailError ? (
        <img
          src={thumbnailUrl}
          alt="YouTube video thumbnail"
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          onError={handleThumbnailError}
          onClick={handlePlay}
        />
      ) : (
        <div 
          className="w-full h-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center"
          onClick={handlePlay}
        >
          <div className="text-center text-white">
            <div className="text-4xl mb-2">📺</div>
            <p className="text-sm font-medium">YouTube 동영상</p>
            <p className="text-xs opacity-75 mt-1">클릭하여 재생</p>
          </div>
        </div>
      )}
      
      {/* 재생 버튼 오버레이 */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onClick={handlePlay}
      >
        <div className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-lg transform group-hover:scale-110 transition-transform duration-200">
          <FontAwesomeIcon icon={faPlay} className="w-6 h-6 ml-1" />
        </div>
      </div>

      {/* YouTube 브랜딩 */}
      <div className="absolute bottom-3 left-3">
        <div className="bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs font-medium flex items-center">
          <span className="text-red-500 mr-1">▶</span>
          YouTube
        </div>
      </div>

      {/* YouTube에서 열기 버튼 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          openInYouTube();
        }}
        className="absolute top-3 right-3 bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
        title="YouTube에서 열기"
      >
        <FontAwesomeIcon icon={faExternalLinkAlt} className="w-3 h-3" />
      </button>
    </div>
  );
};

/**
 * 작은 YouTube 미리보기 카드 (PostEditor용)
 */
export const YouTubePreviewCard = ({ url, onRemove, className = "" }) => {
  const videoId = getYouTubeVideoId(url);
  const thumbnailUrl = getYouTubeThumbnail(videoId, 'default');
  
  if (!videoId) return null;

  return (
    <div className={`relative bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm ${className}`}>
      <div className="flex">
        {/* 썸네일 */}
        <div className="relative w-24 h-16 bg-gray-900 flex-shrink-0">
          <img
            src={thumbnailUrl}
            alt="YouTube thumbnail"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
            <FontAwesomeIcon icon={faPlay} className="text-white w-3 h-3" />
          </div>
        </div>
        
        {/* 정보 */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-900 truncate">
                YouTube 동영상
              </p>
              <p className="text-xs text-gray-500 truncate mt-1">
                {url}
              </p>
            </div>
            
            {onRemove && (
              <button
                onClick={onRemove}
                className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="링크 제거"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default YouTubeEmbed;