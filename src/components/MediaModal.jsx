/* eslint-disable react/prop-types */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faPlay, faPause, faVolumeUp, faVolumeMute } from "@fortawesome/free-solid-svg-icons";
import { isVideoFile, isCloudflareStreamUrl, getCloudflareStreamUid } from '../utils/mediaUtils';

const MediaModal = ({
  isOpen,
  onClose,
  mediaFiles = [],
  initialIndex = 0,
  initialTime = 0  // 동영상 시작 시간 (초)
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 동영상 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);

  // 터치/스와이프 상태
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [touchEnd, setTouchEnd] = useState({ x: 0, y: 0 });
  const [initialDistance, setInitialDistance] = useState(0);
  const [initialScale, setInitialScale] = useState(1);

  const containerRef = useRef(null);
  const mediaRef = useRef(null);
  const videoRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const scrollYRef = useRef(0);

  // 인덱스 초기화
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsMuted(false);
      setProgress(0);
      setShowControls(true);
    }
  }, [isOpen, initialIndex]);

  // 동영상 자동 재생 (모달 열릴 때 & 인덱스 변경 시)
  useEffect(() => {
    if (isOpen && videoRef.current) {
      // 피드에서 전달받은 재생 위치로 이동
      if (initialTime > 0 && currentIndex === initialIndex) {
        videoRef.current.currentTime = initialTime;
      }
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  }, [isOpen, currentIndex, initialTime, initialIndex]);

  // ESC 키로 모달 닫기 & 배경 스크롤 방지
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const preventTouchMove = (e) => {
      // 모달 내부 터치는 허용하되 배경 스크롤 방지
      if (!containerRef.current?.contains(e.target)) {
        e.preventDefault();
      }
    };

    const preventScroll = (e) => {
      e.preventDefault();
    };

    scrollYRef.current = window.scrollY;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('wheel', preventScroll, { passive: false });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('wheel', preventScroll);
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isOpen, onClose]);

  // 컨트롤 자동 숨김
  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // 두 손가락 사이 거리 계산
  const getDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 터치 시작
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      // 핀치 줌 시작
      const distance = getDistance(e.touches);
      setInitialDistance(distance);
      setInitialScale(scale);
    } else if (e.touches.length === 1) {
      // 스와이프 또는 드래그 시작
      const touch = e.touches[0];
      setTouchStart({ x: touch.clientX, y: touch.clientY });
      setTouchEnd({ x: touch.clientX, y: touch.clientY });

      if (scale > 1) {
        setIsDragging(true);
        setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
      }
    }

    setShowControls(true);
    hideControlsAfterDelay();
  };

  // 터치 이동
  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      // 핀치 줌
      const distance = getDistance(e.touches);
      const newScale = Math.min(Math.max(initialScale * (distance / initialDistance), 1), 4);
      setScale(newScale);

      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      setTouchEnd({ x: touch.clientX, y: touch.clientY });

      if (isDragging && scale > 1) {
        // 확대 상태에서 드래그
        const newX = touch.clientX - dragStart.x;
        const newY = touch.clientY - dragStart.y;
        setPosition({ x: newX, y: newY });
      }
    }
  };

  // 터치 종료
  const handleTouchEnd = () => {
    if (scale <= 1 && !isDragging) {
      // 스와이프 감지 (확대 상태가 아닐 때만)
      const deltaX = touchStart.x - touchEnd.x;
      const deltaY = touchStart.y - touchEnd.y;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // 수평 스와이프가 더 크고 최소 거리 이상일 때
      if (absDeltaX > absDeltaY && absDeltaX > 50) {
        if (deltaX > 0 && currentIndex < mediaFiles.length - 1) {
          // 왼쪽 스와이프 - 다음
          goToNext();
        } else if (deltaX < 0 && currentIndex > 0) {
          // 오른쪽 스와이프 - 이전
          goToPrev();
        }
      }
    }

    setIsDragging(false);
    setInitialDistance(0);
  };

  // 더블탭 줌
  const handleDoubleTap = (e) => {
    e.preventDefault();
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  };

  // 다음/이전 미디어
  const goToNext = () => {
    if (currentIndex < mediaFiles.length - 1) {
      setCurrentIndex(prev => prev + 1);
      resetMediaState();
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      resetMediaState();
    }
  };

  const goToIndex = (index) => {
    setCurrentIndex(index);
    resetMediaState();
  };

  const resetMediaState = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsPlaying(false);
    setProgress(0);
  };

  // 동영상 컨트롤
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
    setShowControls(true);
    hideControlsAfterDelay();
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVideoProgress = () => {
    if (videoRef.current && videoRef.current.duration) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(progress);
    }
  };

  const handleProgressClick = (e) => {
    e.stopPropagation();
    if (videoRef.current && videoRef.current.duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const newTime = (clickX / width) * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
    }
  };

  // 배경 클릭으로 닫기
  const handleBackgroundClick = (e) => {
    if (e.target === containerRef.current) {
      onClose();
    }
  };

  if (!isOpen || mediaFiles.length === 0) return null;

  const currentMedia = mediaFiles[currentIndex];
  const isVideo = isVideoFile(currentMedia);
  const isCloudflareStream = isCloudflareStreamUrl(currentMedia);

  // Cloudflare Stream iframe URL 생성
  const getCloudflareStreamIframeUrl = (url) => {
    const uid = getCloudflareStreamUid(url);
    if (!uid) return '';
    const customerSubdomain = 'customer-91fe46eef7b97939176dd0e43747409a';
    return `https://${customerSubdomain}.cloudflarestream.com/${uid}/iframe?autoplay=true&loop=true&controls=true`;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black flex items-center justify-center"
      style={{
        zIndex: 2147483647, // 최대 z-index 값으로 모든 요소 위에 표시
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        touchAction: 'none'
      }}
      onClick={handleBackgroundClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white hover:bg-opacity-70 transition-all"
      >
        <FontAwesomeIcon icon={faXmark} className="w-6 h-6" />
      </button>

      {/* 미디어 카운터 */}
      {mediaFiles.length > 1 && (
        <div className="absolute top-4 left-4 z-10 bg-black bg-opacity-50 text-white text-sm px-3 py-1 rounded-full">
          {currentIndex + 1} / {mediaFiles.length}
        </div>
      )}

      {/* 메인 미디어 영역 */}
      <div
        ref={mediaRef}
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onDoubleClick={handleDoubleTap}
      >
        {isCloudflareStream ? (
          // Cloudflare Stream iframe 플레이어
          <div className="relative w-full h-full flex items-center justify-center">
            <iframe
              src={getCloudflareStreamIframeUrl(currentMedia)}
              className="w-full h-full max-w-4xl max-h-[80vh]"
              style={{ border: 'none' }}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : isVideo ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              src={currentMedia}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{
                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              }}
              autoPlay
              loop
              playsInline
              onClick={togglePlay}
              onTimeUpdate={handleVideoProgress}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {/* 동영상 컨트롤 오버레이 - 재생/일시정지 버튼 */}
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              onClick={togglePlay}
            >
              {!isPlaying && (
                <div className="w-20 h-20 bg-black bg-opacity-60 rounded-full flex items-center justify-center">
                  <FontAwesomeIcon icon={faPlay} className="w-8 h-8 text-white ml-1" />
                </div>
              )}
            </div>

            {/* 음소거/음소거해제 버튼 - 항상 보이게 */}
            <button
              onClick={toggleMute}
              className="absolute top-4 right-16 w-10 h-10 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white"
            >
              <FontAwesomeIcon icon={isMuted ? faVolumeMute : faVolumeUp} className="w-5 h-5" />
            </button>

            {/* 진행률 바 - 항상 보이게 */}
            <div
              className="absolute bottom-20 left-4 right-4 h-2 bg-white bg-opacity-30 rounded-full cursor-pointer"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-white rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <img
            src={currentMedia}
            alt={`미디어 ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            }}
            draggable={false}
          />
        )}
      </div>

      {/* 인디케이터 (다중 미디어) */}
      {mediaFiles.length > 1 && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-2">
          {mediaFiles.map((_, index) => (
            <button
              key={index}
              onClick={() => goToIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                index === currentIndex
                  ? 'bg-white w-3 h-3'
                  : 'bg-white bg-opacity-50 hover:bg-opacity-75'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaModal;
