/* eslint-disable react/prop-types */
import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faSpinner, faVolumeUp, faVolumeMute } from "@fortawesome/free-solid-svg-icons";
import { getCloudflareStreamUid } from '../utils/mediaUtils';

/**
 * Cloudflare Stream 동영상 플레이어 컴포넌트
 * iframe 방식으로 HLS 스트리밍 재생
 */
const CloudflareStreamPlayer = ({
  url,
  autoplay = false,
  muted: initialMuted = true,
  loop = true,
  controls = false,
  showMuteToggle = false,  // 음소거 토글 버튼 표시 여부
  className = '',
  aspectRatio = 'square', // 'square', 'video', 'auto'
  onClick,
  onReady,
  onError,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showPlayer, setShowPlayer] = useState(autoplay);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const iframeRef = useRef(null);

  const uid = getCloudflareStreamUid(url);

  // autoplay prop 변경 시 showPlayer 상태 동기화
  useEffect(() => {
    if (autoplay) {
      setShowPlayer(true);
    }
  }, [autoplay]);

  // 음소거 토글 핸들러 (iframe 재로드)
  const handleMuteToggle = (e) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  // Customer subdomain (from your Cloudflare account)
  const customerSubdomain = 'customer-xi3tfx9anf8ild8c';

  // Cloudflare Stream iframe URL 생성
  const getIframeSrc = () => {
    if (!uid) return '';
    const params = new URLSearchParams({
      muted: isMuted ? 'true' : 'false',
      autoplay: showPlayer ? 'true' : 'false',
      loop: loop ? 'true' : 'false',
      controls: controls ? 'true' : 'false',
      preload: 'auto',
    });
    return `https://${customerSubdomain}.cloudflarestream.com/${uid}/iframe?${params.toString()}`;
  };

  // 썸네일 URL 생성 (1:1 비율일 때 fit=crop 적용)
  const getThumbnailUrl = () => {
    if (!uid) return '';
    const fitParam = aspectRatio === 'square' ? '&fit=crop' : '';
    return `https://${customerSubdomain}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg?time=1s&width=640&height=640${fitParam}`;
  };

  const aspectRatioClass = {
    'square': 'aspect-square',
    'video': 'aspect-video',
    'auto': '',
  }[aspectRatio] || 'aspect-square';

  const handleThumbnailClick = (e) => {
    e.stopPropagation();
    setShowPlayer(true);
    if (onClick) onClick(e);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    if (onReady) onReady();
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
    if (onError) onError();
  };

  if (!uid) {
    return (
      <div className={`bg-gray-800 flex items-center justify-center ${aspectRatioClass} ${className}`}>
        <span className="text-white text-sm">동영상을 로드할 수 없습니다</span>
      </div>
    );
  }

  // 에러 상태
  if (hasError) {
    return (
      <div className={`bg-gray-800 flex flex-col items-center justify-center ${aspectRatioClass} ${className}`}>
        <div className="text-4xl mb-2">🎥</div>
        <span className="text-white text-sm">동영상 인코딩 중...</span>
        <span className="text-gray-400 text-xs mt-1">잠시 후 다시 시도해주세요</span>
      </div>
    );
  }

  // 썸네일 표시 (자동재생 아닐 때)
  if (!showPlayer) {
    return (
      <div
        className={`relative bg-gray-900 cursor-pointer ${aspectRatioClass} ${className}`}
        onClick={handleThumbnailClick}
      >
        <img
          src={getThumbnailUrl()}
          alt="동영상 썸네일"
          className="w-full h-full object-cover"
          onError={(e) => {
            // 썸네일 로드 실패 시 대체 UI
            e.target.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-40">
          <div className="bg-purple-600 rounded-full p-4 mb-2 hover:bg-purple-700 transition-colors">
            <FontAwesomeIcon icon={faPlay} className="w-8 h-8 text-white ml-1" />
          </div>
          <span className="text-white text-xs">클릭하여 재생</span>
        </div>
      </div>
    );
  }

  // iframe 플레이어
  // 1:1 비율일 때 CSS로 중앙 크롭 적용 (16:9 → 1:1)
  if (aspectRatio === 'square') {
    return (
      <div className={`relative bg-gray-900 aspect-square overflow-hidden ${className}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
            <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={getIframeSrc()}
          className="absolute pointer-events-none"
          style={{
            width: '177.78%',
            height: '177.78%',
            left: '-38.89%',
            top: '-38.89%',
            border: 'none'
          }}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />

        {/* 클릭 영역 (전체화면 모달 열기용) */}
        {onClick && (
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={onClick}
          />
        )}

        {/* 동영상 아이콘 */}
        <div className="absolute top-3 left-3 z-10 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs flex items-center gap-1 pointer-events-none">
          <FontAwesomeIcon icon={faPlay} className="w-3 h-3" />
          <span>동영상</span>
        </div>

        {/* 음소거 토글 버튼 */}
        {showMuteToggle && (
          <button
            onClick={handleMuteToggle}
            className="absolute bottom-3 right-3 z-20 bg-black bg-opacity-60 text-white p-2 rounded-full hover:bg-opacity-80 transition-all"
          >
            <FontAwesomeIcon
              icon={isMuted ? faVolumeMute : faVolumeUp}
              className="w-4 h-4"
            />
          </button>
        )}
      </div>
    );
  }

  // 기본 모드: 원본 비율 유지
  return (
    <div className={`relative bg-gray-900 ${aspectRatioClass} ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
          <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-white animate-spin" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={getIframeSrc()}
        className="w-full h-full pointer-events-none"
        style={{ border: 'none' }}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={handleIframeLoad}
        onError={handleIframeError}
      />

      {/* 클릭 영역 (전체화면 모달 열기용) */}
      {onClick && (
        <div
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={onClick}
        />
      )}

      {/* 음소거 토글 버튼 */}
      {showMuteToggle && (
        <button
          onClick={handleMuteToggle}
          className="absolute bottom-3 right-3 z-20 bg-black bg-opacity-60 text-white p-2 rounded-full hover:bg-opacity-80 transition-all"
        >
          <FontAwesomeIcon
            icon={isMuted ? faVolumeMute : faVolumeUp}
            className="w-4 h-4"
          />
        </button>
      )}
    </div>
  );
};

export default CloudflareStreamPlayer;
