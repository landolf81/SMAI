/* eslint-disable react/prop-types */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faVolumeUp, faVolumeMute } from "@fortawesome/free-solid-svg-icons";
import { isVideoFile, isCloudflareStreamUrl } from '../utils/mediaUtils';
import CloudflareStreamPlayer from './CloudflareStreamPlayer';

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
  const closedByPopStateRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const hasAddedHistoryRef = useRef(false);

  // onClose ref 동기화
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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

  // ESC 키로 모달 닫기 & 배경 스크롤 방지 & 뒤로가기 처리
  useEffect(() => {
    if (!isOpen) {
      // 모달이 닫히면 히스토리 추가 플래그 리셋
      hasAddedHistoryRef.current = false;
      return;
    }

    // 모달 열릴 때 ref 초기화
    closedByPopStateRef.current = false;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    const preventScroll = (e) => {
      e.preventDefault();
    };

    // 뒤로가기 버튼으로 모달 닫기
    const handlePopState = () => {
      closedByPopStateRef.current = true;
      onCloseRef.current();
    };

    // 모달 열릴 때 히스토리에 상태 추가 (한 번만)
    if (!hasAddedHistoryRef.current) {
      window.history.pushState({ mediaModal: true }, '');
      hasAddedHistoryRef.current = true;
    }

    window.addEventListener('popstate', handlePopState);

    scrollYRef.current = window.scrollY;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('wheel', preventScroll, { passive: false });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('wheel', preventScroll);
      document.body.style.overflow = '';
      document.body.style.touchAction = '';

      // X버튼/ESC로 닫은 경우에만 히스토리 정리
      if (!closedByPopStateRef.current && window.history.state?.mediaModal) {
        window.history.back();
      }
    };
  }, [isOpen]); // onClose 의존성 제거 - ref로 참조

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
      {/* 닫기 버튼 - 최상위 z-index로 항상 클릭 가능 */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 w-12 h-12 bg-black/70 rounded-full flex items-center justify-center text-white active:bg-black/90"
        style={{ zIndex: 9999 }}
      >
        <FontAwesomeIcon icon={faXmark} className="w-7 h-7" />
      </button>

      {/* 미디어 카운터 */}
      {mediaFiles.length > 1 && (
        <div className="absolute top-4 left-4 z-10 bg-black bg-opacity-50 text-white text-sm px-3 py-1 rounded-full">
          {currentIndex + 1} / {mediaFiles.length}
        </div>
      )}

      {/* 메인 미디어 영역 - 9:16 비율 (릴스/스토리 스타일) */}
      <div
        ref={mediaRef}
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onDoubleClick={handleDoubleTap}
      >
        {isCloudflareStream ? (
          <div
            className="relative flex items-center justify-center overflow-hidden"
            style={{
              width: 'calc(100vh * 9 / 16)',
              maxWidth: '100vw',
              height: '100vh'
            }}
          >
            <CloudflareStreamPlayer
              url={currentMedia}
              autoplay={true}
              muted={false}
              loop={true}
              controls={false}
              hideOverlay={true}
              aspectRatio="9-16"
              className="w-full h-full"
            />
          </div>
        ) : isVideo ? (
          <div
            className="relative flex items-center justify-center overflow-hidden"
            style={{
              width: 'calc(100vh * 9 / 16)',
              maxWidth: '100vw',
              height: '100vh'
            }}
          >
            <video
              ref={videoRef}
              src={currentMedia}
              className="w-full h-full object-cover"
              style={{ willChange: 'transform' }}
              preload="auto"
              autoPlay
              loop
              playsInline
              muted={isMuted}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {/* 화면 클릭 시 음소거 토글 */}
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={toggleMute}
            />

            {/* 음소거 아이콘 (우하단) */}
            <div className="absolute bottom-3 right-3 z-20 bg-black bg-opacity-50 text-white p-1.5 rounded-full pointer-events-none">
              <FontAwesomeIcon
                icon={isMuted ? faVolumeMute : faVolumeUp}
                className="w-3 h-3"
              />
            </div>
          </div>
        ) : (
          <div
            className="relative flex items-center justify-center overflow-hidden"
            style={{
              width: 'calc(100vh * 9 / 16)',
              maxWidth: '100vw',
              height: '100vh'
            }}
          >
            <img
              ref={imageRef}
              src={currentMedia}
              alt={`미디어 ${currentIndex + 1}`}
              className="w-full h-full object-cover"
              style={{
                willChange: 'transform',
                transform: 'scale(1) translate(0px, 0px)'
              }}
              draggable={false}
            />
          </div>
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
