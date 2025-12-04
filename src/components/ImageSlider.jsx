/* eslint-disable react/prop-types */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faPause, faVolumeUp, faVolumeMute } from "@fortawesome/free-solid-svg-icons";
import { isVideoFile, getMediaIcon, normalizeMediaUrl } from '../utils/mediaUtils';

const ImageSlider = ({ images = [], baseUrl = "/uploads/posts/", aspectRatio = "auto", onMediaClick, videoRef: externalVideoRef }) => {
    // 이미지 URL 정규화 (완전한 URL이면 그대로, 아니면 baseUrl 추가)
    const normalizedImages = useMemo(() => {
        return images.map(img => {
            if (!img) return '';
            // 이미 완전한 URL인 경우 그대로 반환
            if (img.startsWith('http://') || img.startsWith('https://')) {
                return img;
            }
            // 파일명만 있는 경우 normalizeMediaUrl 사용
            return normalizeMediaUrl(img, baseUrl);
        });
    }, [images, baseUrl]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [videoStates, setVideoStates] = useState({}); // 각 동영상의 상태 관리
    const videoRefs = useRef({}); // 각 동영상의 ref 관리

    // 인덱스 변경 시 동영상 상태 초기화
    useEffect(() => {
        if (isVideoFile(normalizedImages[currentIndex]) && !videoStates[currentIndex]) {
            setVideoStates(prev => ({
                ...prev,
                [currentIndex]: {
                    isPlaying: false,
                    isMuted: true,
                    showControls: false,
                    progress: 0
                }
            }));
        }
    }, [currentIndex, normalizedImages]);

    // 다중 이미지 자동 전환 (3초) - 이미지일 때만 (동영상은 제외)
    useEffect(() => {
        // 이미지가 2개 이상이고, 현재 미디어가 동영상이 아닐 때만 자동 전환
        if (normalizedImages.length <= 1) return;
        if (isVideoFile(normalizedImages[currentIndex])) return;

        const autoTransitionTimer = setInterval(() => {
            setCurrentIndex((prevIndex) =>
                prevIndex === normalizedImages.length - 1 ? 0 : prevIndex + 1
            );
        }, 3000);

        return () => clearInterval(autoTransitionTimer);
    }, [currentIndex, normalizedImages]);

    // 동영상 제어 함수들
    const toggleVideoPlay = (index) => {
        const video = videoRefs.current[index];
        if (!video) return;

        const currentState = videoStates[index] || {};
        const isPlaying = !currentState.isPlaying;

        if (isPlaying) {
            video.play();
        } else {
            video.pause();
        }

        setVideoStates(prev => ({
            ...prev,
            [index]: { ...prev[index], isPlaying }
        }));
    };

    const toggleVideoMute = (index) => {
        const video = videoRefs.current[index];
        if (!video) return;

        const isMuted = !video.muted;
        video.muted = isMuted;

        setVideoStates(prev => ({
            ...prev,
            [index]: { ...prev[index], isMuted }
        }));
    };

    const handleVideoProgress = (index) => {
        const video = videoRefs.current[index];
        if (!video || !video.duration) return;

        const progress = (video.currentTime / video.duration) * 100;
        setVideoStates(prev => ({
            ...prev,
            [index]: { ...prev[index], progress }
        }));
    };

    // 컨테이너 스타일 결정
    const containerClass = aspectRatio === "square"
        ? "w-full h-full"
        : "w-full h-auto";

    const mediaClass = aspectRatio === "square"
        ? "w-full h-full object-cover"
        : "w-full h-auto object-contain";

    // 미디어가 없거나 1개 이하면 슬라이더 없이 단순 표시
    if (!normalizedImages || normalizedImages.length === 0) {
        return <div className={`${containerClass} bg-gray-200 flex items-center justify-center text-gray-500`}>미디어가 없습니다.</div>;
    }

    // 단일 미디어용 비디오 ref
    const singleVideoRef = useRef(null);

    if (normalizedImages.length === 1) {
        const isVideo = isVideoFile(normalizedImages[0]);

        if (isVideo) {
            return (
                <div className={`${containerClass} relative`}>
                    {/* 피드 동영상: 자동재생, 무음, 루프, 클릭시 모달 */}
                    <video
                        ref={singleVideoRef}
                        key={normalizedImages[0]}
                        src={normalizedImages[0]}
                        className={`${mediaClass} cursor-pointer`}
                        loop
                        muted
                        playsInline
                        autoPlay
                        onClick={() => {
                            const currentTime = singleVideoRef.current?.currentTime || 0;
                            onMediaClick && onMediaClick(0, currentTime);
                        }}
                    />
                    {/* 동영상 아이콘 표시 */}
                    <div className="absolute top-3 left-3 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                        <FontAwesomeIcon icon={faPlay} className="w-3 h-3" />
                        <span>동영상</span>
                    </div>
                </div>
            );
        } else {
            return (
                <div className={containerClass}>
                    <img
                        src={normalizedImages[0]}
                        alt="게시물 이미지"
                        className={`${mediaClass} cursor-pointer`}
                        onClick={() => onMediaClick && onMediaClick(0)}
                    />
                </div>
            );
        }
    }

    // 다음 이미지로 이동
    const nextImage = () => {
        // 현재 동영상 정지
        const currentVideo = videoRefs.current[currentIndex];
        if (currentVideo && isVideoFile(normalizedImages[currentIndex])) {
            currentVideo.pause();
            setVideoStates(prev => ({
                ...prev,
                [currentIndex]: { ...prev[currentIndex], isPlaying: false }
            }));
        }

        setCurrentIndex((prevIndex) =>
            prevIndex === normalizedImages.length - 1 ? 0 : prevIndex + 1
        );
    };

    // 이전 이미지로 이동
    const prevImage = () => {
        // 현재 동영상 정지
        const currentVideo = videoRefs.current[currentIndex];
        if (currentVideo && isVideoFile(normalizedImages[currentIndex])) {
            currentVideo.pause();
            setVideoStates(prev => ({
                ...prev,
                [currentIndex]: { ...prev[currentIndex], isPlaying: false }
            }));
        }

        setCurrentIndex((prevIndex) =>
            prevIndex === 0 ? normalizedImages.length - 1 : prevIndex - 1
        );
    };

    // 특정 이미지로 직접 이동
    const goToImage = (index) => {
        // 현재 동영상 정지
        const currentVideo = videoRefs.current[currentIndex];
        if (currentVideo && isVideoFile(normalizedImages[currentIndex])) {
            currentVideo.pause();
            setVideoStates(prev => ({
                ...prev,
                [currentIndex]: { ...prev[currentIndex], isPlaying: false }
            }));
        }

        setCurrentIndex(index);
    };

    // 터치/스와이프 이벤트 처리
    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);

    const handleTouchStart = (e) => {
        // CSS touch-action으로 제어하므로 preventDefault 불필요
        setTouchStart(e.targetTouches[0].clientX);
        setTouchEnd(0);
    };

    const handleTouchMove = (e) => {
        // CSS touch-action으로 제어하므로 preventDefault 불필요
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        // CSS touch-action으로 제어하므로 preventDefault 불필요
        if (!touchStart || !touchEnd) return;
        
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 30;  // 더 민감하게 (50 → 30)
        const isRightSwipe = distance < -30; // 더 민감하게 (-50 → -30)

        // console.log('스와이프 감지:', { distance, isLeftSwipe, isRightSwipe }); // 디버깅용 로그 비활성화

        if (isLeftSwipe) {
            // console.log('왼쪽 스와이프 - 다음 이미지'); // 디버깅용 로그 비활성화
            nextImage();
        } else if (isRightSwipe) {
            // console.log('오른쪽 스와이프 - 이전 이미지'); // 디버깅용 로그 비활성화
            prevImage();
        }
        
        // 터치 상태 초기화
        setTouchStart(0);
        setTouchEnd(0);
    };

    // 키보드 네비게이션 추가
    const handleKeyDown = (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prevImage();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            nextImage();
        }
    };

    return (
        <div
            className={`relative ${containerClass} focus:outline-none`}
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            {/* 메인 미디어 표시 영역 */}
            <div
                className={`relative ${containerClass} overflow-hidden select-none`}
                style={{ touchAction: 'pan-y pinch-zoom' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {isVideoFile(normalizedImages[currentIndex]) ? (
                    // 피드 동영상: 자동재생, 무음, 루프, 클릭시 모달
                    <>
                        <video
                            ref={(el) => { videoRefs.current[currentIndex] = el; }}
                            key={`video-${currentIndex}-${normalizedImages[currentIndex]}`}
                            src={normalizedImages[currentIndex]}
                            className={`${mediaClass} cursor-pointer`}
                            loop
                            muted
                            playsInline
                            autoPlay
                            onClick={() => {
                                const currentTime = videoRefs.current[currentIndex]?.currentTime || 0;
                                onMediaClick && onMediaClick(currentIndex, currentTime);
                            }}
                        />
                        {/* 동영상 아이콘 표시 */}
                        <div className="absolute top-3 left-3 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                            <FontAwesomeIcon icon={faPlay} className="w-3 h-3" />
                            <span>동영상</span>
                        </div>
                    </>
                ) : (
                    // 이미지 표시
                    <img
                        src={normalizedImages[currentIndex]}
                        alt={`게시물 이미지 ${currentIndex + 1}`}
                        className={`${mediaClass} cursor-pointer transition-opacity duration-300`}
                        onClick={() => onMediaClick && onMediaClick(currentIndex)}
                        onError={(e) => {
                            console.error('이미지 로드 실패:', e.target.src);
                            e.target.style.display = 'none';
                        }}
                    />
                )}


                {/* 미디어 카운터 */}
                <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded-full z-10">
                    {currentIndex + 1} / {normalizedImages.length}
                    <span className="ml-1">{getMediaIcon(normalizedImages[currentIndex])}</span>
                </div>
            </div>


            {/* 이미지 인디케이터 - 이미지 아래로 이동 */}
            {normalizedImages.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center items-center gap-1.5">
                    {normalizedImages.map((_, index) => (
                        <span
                            key={index}
                            onClick={() => goToImage(index)}
                            className="cursor-pointer"
                            style={{
                                width: index === currentIndex ? '7px' : '6px',
                                height: index === currentIndex ? '7px' : '6px',
                                borderRadius: '50%',
                                backgroundColor: index === currentIndex ? '#3b82f6' : 'rgba(255,255,255,0.7)',
                                display: 'inline-block',
                                transition: 'all 0.2s ease'
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default ImageSlider;
