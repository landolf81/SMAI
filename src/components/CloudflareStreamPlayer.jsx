/* eslint-disable react/prop-types */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faSpinner, faVolumeUp, faVolumeMute } from "@fortawesome/free-solid-svg-icons";
import { getCloudflareStreamUid } from '../utils/mediaUtils';
import Hls from 'hls.js';

/**
 * Cloudflare Stream 동영상 플레이어 컴포넌트
 * HLS.js를 사용하여 video 태그로 직접 재생
 * object-fit: cover 적용으로 확대 없이 크롭
 */
const CloudflareStreamPlayer = ({
  url,
  autoplay = false,
  muted: initialMuted = true,
  controls = false,
  showMuteToggle = false,
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
  const [isWaitingToReplay, setIsWaitingToReplay] = useState(false);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const replayTimeoutRef = useRef(null);

  const uid = getCloudflareStreamUid(url);

  // Customer subdomain (from your Cloudflare account)
  const customerSubdomain = 'customer-xi3tfx9anf8ild8c';

  // HLS playback URL
  const playbackUrl = uid ? `https://${customerSubdomain}.cloudflarestream.com/${uid}/manifest/video.m3u8` : '';

  // 썸네일 URL 생성
  const getThumbnailUrl = useCallback(() => {
    if (!uid) return '';
    const fitParam = aspectRatio === 'square' ? '&fit=crop' : '';
    return `https://${customerSubdomain}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg?time=1s&width=640&height=640${fitParam}`;
  }, [uid, aspectRatio]);

  // 이전 autoplay 상태를 추적하기 위한 ref
  const prevAutoplayRef = useRef(autoplay);

  // autoplay prop 변경 시 재생/정지 제어
  useEffect(() => {
    const wasAutoplay = prevAutoplayRef.current;
    prevAutoplayRef.current = autoplay;

    if (autoplay) {
      setShowPlayer(true);
      // 다시 화면에 들어올 때 재생 시작
      if (videoRef.current && !wasAutoplay) {
        // 화면 복귀 시 항상 음소거 상태로 재생 + 아이콘도 동기화
        videoRef.current.muted = true;
        setIsMuted(true); // 아이콘 상태도 음소거로 동기화
        videoRef.current.play().catch(() => {});
      }
    } else if (videoRef.current) {
      // 화면 밖으로 나가면 (autoplay가 false가 되면) 동영상 정지 + 음소거 + 재생위치 리셋
      videoRef.current.pause();
      videoRef.current.muted = true;
      videoRef.current.currentTime = 0;  // 재생 위치 리셋
      setIsMuted(true);

      // replay 타이머 클리어
      if (replayTimeoutRef.current) {
        clearTimeout(replayTimeoutRef.current);
        replayTimeoutRef.current = null;
      }
      setIsWaitingToReplay(false);
    }
  }, [autoplay]);

  // 컴포넌트 언마운트 시 HLS 정리 및 동영상 정지
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (replayTimeoutRef.current) {
        clearTimeout(replayTimeoutRef.current);
      }
    };
  }, []);

  // HLS.js 초기화 및 재생
  useEffect(() => {
    if (!showPlayer || !videoRef.current || !uid) return;

    const video = videoRef.current;

    // Safari는 네이티브 HLS 지원
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        if (onReady) onReady();
        if (autoplay) {
          video.play().catch(() => {});
        }
      });
      video.addEventListener('error', () => {
        setHasError(true);
        setIsLoading(false);
        if (onError) onError();
      });
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hlsRef.current = hls;

      hls.loadSource(playbackUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        if (onReady) onReady();
        if (autoplay) {
          video.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setHasError(true);
          setIsLoading(false);
          if (onError) onError();
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else {
      // HLS not supported
      setHasError(true);
      setIsLoading(false);
    }
  }, [showPlayer, uid, playbackUrl, autoplay, onReady, onError]);

  // 음소거 상태 변경
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // 음소거 토글 핸들러
  const handleMuteToggle = (e) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  // 동영상 재생 완료 시 3초 후 다시 재생
  const handleVideoEnded = () => {
    // 화면 밖이면(autoplay=false) 재생하지 않음
    if (!autoplay) {
      setIsWaitingToReplay(false);
      return;
    }

    setIsWaitingToReplay(true);

    // 기존 타이머 클리어
    if (replayTimeoutRef.current) {
      clearTimeout(replayTimeoutRef.current);
    }

    // 3초 후 처음부터 재생
    replayTimeoutRef.current = setTimeout(() => {
      // 타이머 실행 시점에도 autoplay 재확인
      if (videoRef.current && autoplay) {
        videoRef.current.muted = true;  // 음소거 보장
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
      setIsWaitingToReplay(false);
    }, 3000);
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

  if (!uid) {
    return (
      <div className={`bg-gray-800 flex items-center justify-center ${aspectRatioClass} ${className}`}>
        <span className="text-white text-sm">동영상을 로드할 수 없습니다</span>
      </div>
    );
  }

  // 에러 상태 - 썸네일 + 인코딩 중 오버레이
  if (hasError) {
    return (
      <div className={`relative bg-gray-900 ${aspectRatioClass} ${className}`}>
        {/* 썸네일 배경 */}
        <img
          src={getThumbnailUrl()}
          alt="동영상 썸네일"
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        {/* 인코딩 중 오버레이 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60">
          <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-white animate-spin mb-2" />
          <span className="text-white text-sm">동영상 인코딩 중...</span>
          <span className="text-gray-400 text-xs mt-1">잠시 후 다시 시도해주세요</span>
        </div>
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

  // video 태그 플레이어 (object-fit: cover로 크롭)
  return (
    <div className={`relative bg-gray-900 ${aspectRatioClass} overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
          <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-white animate-spin" />
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay={autoplay}
        muted={isMuted}
        playsInline
        controls={controls}
        onEnded={handleVideoEnded}
      />

      {/* 클릭 영역 (전체화면 모달 열기용) */}
      {onClick && !controls && (
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
};

export default CloudflareStreamPlayer;
