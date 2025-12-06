/* eslint-disable react/prop-types */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faPlay, faPause, faVolumeUp, faVolumeMute } from "@fortawesome/free-solid-svg-icons";
import { isVideoFile, isCloudflareStreamUrl, getCloudflareStreamUid } from '../utils/mediaUtils';

const MediaModal = ({
  isOpen,
  onClose,
  mediaFiles = [],
  initialIndex = 0,
  initialTime = 0
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // 동영상 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);

  // 터치/스와이프 상태
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [touchEnd, setTouchEnd] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);
  const mediaRef = useRef(null);
  const videoRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const scrollYRef = useRef(0);

  // 핀치줌 상태 (ref로 관리하여 리렌더링 방지)
  const scaleRef = useRef(1);
  const positionRef = useRef({ x: 0, y: 0 });
  const initialDistanceRef = useRef(0);
  const initialScaleRef = useRef(1);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const imageRef = useRef(null);

  // 인덱스 초기화
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      scaleRef.current = 1;
      positionRef.current = { x: 0, y: 0 };
      setIsMuted(false);
      setProgress(0);
      setShowControls(true);
      // 초기 transform 적용
      if (imageRef.current) {
        imageRef.current.style.transform = 'scale(1) translate(0px, 0px)';
      }
    }
  }, [isOpen, initialIndex]);

  // 현재 및 인접 이미지 프리로드 (현재, 현재 ±1)
  useEffect(() => {
    if (!isOpen || mediaFiles.length === 0) return;

    const preloadIndexes = [currentIndex, currentIndex - 1, currentIndex + 1]
      .filter(i => i >= 0 && i < mediaFiles.length);

    preloadIndexes.forEach(index => {
      const url = mediaFiles[index];
      if (!isVideoFile(url) && !isCloudflareStreamUrl(url)) {
        const img = new Image();
        img.src = url;
      }
    });
  }, [isOpen, currentIndex, mediaFiles]);

  // 동영상 자동 재생
  useEffect(() => {
    if (isOpen && videoRef.current) {
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

  // transform 직접 적용 (리렌더링 없이)
  const applyTransform = useCallback(() => {
    if (imageRef.current) {
      const scale = scaleRef.current;
      const pos = positionRef.current;
      imageRef.current.style.transform = `scale(${scale}) translate(${pos.x / scale}px, ${pos.y / scale}px)`;
    }
  }, []);

  // 터치 시작
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      // 핀치 줌 시작
      const distance = getDistance(e.touches);
      initialDistanceRef.current = distance;
      initialScaleRef.current = scaleRef.current;
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      setTouchStart({ x: touch.clientX, y: touch.clientY });
      setTouchEnd({ x: touch.clientX, y: touch.clientY });

      if (scaleRef.current > 1) {
        isDraggingRef.current = true;
        dragStartRef.current = {
          x: touch.clientX - positionRef.current.x,
          y: touch.clientY - positionRef.current.y
        };
      }
    }

    setShowControls(true);
    hideControlsAfterDelay();
  };

  // 터치 이동 (ref 직접 조작으로 성능 최적화)
  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      // 핀치 줌
      const distance = getDistance(e.touches);
      const newScale = Math.min(Math.max(initialScaleRef.current * (distance / initialDistanceRef.current), 1), 4);
      scaleRef.current = newScale;

      if (newScale <= 1) {
        positionRef.current = { x: 0, y: 0 };
      }

      applyTransform();
    } else if (e.touches.length === 1 && isDraggingRef.current && scaleRef.current > 1) {
      const touch = e.touches[0];
      setTouchEnd({ x: touch.clientX, y: touch.clientY });

      // 확대 상태에서 드래그
      const newX = touch.clientX - dragStartRef.current.x;
      const newY = touch.clientY - dragStartRef.current.y;
      positionRef.current = { x: newX, y: newY };

      applyTransform();
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      setTouchEnd({ x: touch.clientX, y: touch.clientY });
    }
  };

  // 터치 종료
  const handleTouchEnd = () => {
    if (scaleRef.current <= 1 && !isDraggingRef.current) {
      // 스와이프 감지
      const deltaX = touchStart.x - touchEnd.x;
      const deltaY = touchStart.y - touchEnd.y;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (absDeltaX > absDeltaY && absDeltaX > 50) {
        if (deltaX > 0 && currentIndex < mediaFiles.length - 1) {
          goToNext();
        } else if (deltaX < 0 && currentIndex > 0) {
          goToPrev();
        }
      }
    }

    isDraggingRef.current = false;
    initialDistanceRef.current = 0;
  };

  // 더블탭 줌
  const handleDoubleTap = (e) => {
    e.preventDefault();
    if (scaleRef.current > 1) {
      scaleRef.current = 1;
      positionRef.current = { x: 0, y: 0 };
    } else {
      scaleRef.current = 2;
    }
    applyTransform();
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
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    setIsPlaying(false);
    setProgress(0);
    // transform 초기화
    if (imageRef.current) {
      imageRef.current.style.transform = 'scale(1) translate(0px, 0px)';
    }
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
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      // iOS에서 볼륨도 함께 설정해야 벨소리가 아닌 미디어 볼륨 사용
      videoRef.current.volume = newMuted ? 0 : 1;
      setIsMuted(newMuted);
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
    const customerSubdomain = 'customer-xi3tfx9anf8ild8c';
    return `https://${customerSubdomain}.cloudflarestream.com/${uid}/iframe?autoplay=true&loop=true&controls=true`;
  };

  // Portal을 사용하여 body에 직접 렌더링 (부모의 transform/will-change 영향 방지)
  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black flex items-center justify-center"
      style={{
        zIndex: 2147483647,
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
              className="max-w-full max-h-full object-contain"
              style={{ willChange: 'transform' }}
              preload="auto"
              autoPlay
              loop
              playsInline
              onClick={togglePlay}
              onTimeUpdate={handleVideoProgress}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {/* 재생/일시정지 버튼 */}
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

            {/* 음소거 버튼 */}
            <button
              onClick={toggleMute}
              className="absolute top-4 right-16 w-10 h-10 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white"
            >
              <FontAwesomeIcon icon={isMuted ? faVolumeMute : faVolumeUp} className="w-5 h-5" />
            </button>

            {/* 진행률 바 */}
            <div
              className="absolute bottom-20 left-4 right-4 h-2 bg-white bg-opacity-30 rounded-full cursor-pointer"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-white rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <img
            ref={imageRef}
            src={currentMedia}
            alt={`미디어 ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain"
            style={{
              willChange: 'transform',
              transform: 'scale(1) translate(0px, 0px)'
            }}
            draggable={false}
          />
        )}
      </div>

      {/* 인디케이터 */}
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
    </div>,
    document.body
  );
};

export default MediaModal;
