import React, { useEffect, useState } from 'react';
import { shouldShowAds } from '../utils/deviceDetector';
import { getImageUrl, DEFAULT_AD_IMAGE } from '../config/api';
import { adService } from '../services';

const MobileAdDisplay = ({ ad }) => {
  const [adMedia, setAdMedia] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [showLandingModal, setShowLandingModal] = useState(false);
  const [modalVideoMuted, setModalVideoMuted] = useState(false); // false = 음소거 해제
  const [modalMediaIndex, setModalMediaIndex] = useState(0); // 모달 내 미디어 인덱스
  const [isVisible, setIsVisible] = useState(false);
  const videoRef = React.useRef(null);
  const adCardRef = React.useRef(null);

  // 추가 미디어 불러오기
  useEffect(() => {
    const fetchAdMedia = async () => {
      if (ad && ad.id) {
        try {
          setLoading(true);
          const mediaData = await adService.getAdMedia(ad.id);
          if (Array.isArray(mediaData) && mediaData.length > 0) {
            setAdMedia(mediaData);
          }
        } catch (error) {
          // 추가 미디어 로드 실패
        } finally {
          setLoading(false);
        }
      }
    };

    fetchAdMedia();
  }, [ad]);

  // 광고 노출 추적
  useEffect(() => {
    if (ad && ad.id) {
      adService.trackAdImpression(ad.id).catch(() => {});
    }
  }, [ad]);

  // Intersection Observer로 스크롤 시 동영상 자동 재생/정지
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);

          if (videoRef.current) {
            if (entry.isIntersecting) {
              // 화면에 보이면 재생
              videoRef.current.play().catch(() => {});
            } else {
              // 화면에서 벗어나면 일시정지
              videoRef.current.pause();
            }
          }
        });
      },
      {
        threshold: 0.5, // 50% 이상 보일 때
      }
    );

    if (adCardRef.current) {
      observer.observe(adCardRef.current);
    }

    return () => {
      if (adCardRef.current) {
        observer.unobserve(adCardRef.current);
      }
    };
  }, [currentMediaIndex]); // currentMediaIndex 변경 시 다시 설정

  // 파일 확장자로 미디어 타입 판단
  const getMediaTypeFromPath = (path) => {
    if (!path) return 'image';
    const extension = path.toLowerCase().split('.').pop();
    const videoExtensions = ['mp4', 'mov', 'webm', 'avi', 'mkv'];
    return videoExtensions.includes(extension) ? 'video' : 'image';
  };

  // 미디어 네비게이션 함수들
  const getCurrentMedia = () => {
    const allMedia = [];

    // 메인 이미지가 있으면 추가 (Supabase는 image_url 사용)
    if (ad?.image_url) {
      allMedia.push({
        path: ad.image_url,
        type: getMediaTypeFromPath(ad.image_url),
        alt: ad.image_alt || ad.title
      });
    }

    // 추가 미디어 추가
    if (adMedia && adMedia.length > 0) {
      allMedia.push(...adMedia.map(media => ({
        path: media.media_url,
        type: media.media_type || getMediaTypeFromPath(media.media_url),
        alt: media.caption || ad.title
      })));
    }

    return allMedia[currentMediaIndex] || null;
  };

  // 모달용 미디어 가져오기
  const getModalMedia = (index) => {
    const allMedia = [];

    // 메인 이미지가 있으면 추가 (Supabase는 image_url 사용)
    if (ad?.image_url) {
      allMedia.push({
        path: ad.image_url,
        type: getMediaTypeFromPath(ad.image_url),
        alt: ad.image_alt || ad.title
      });
    }

    // 추가 미디어 추가
    if (adMedia && adMedia.length > 0) {
      allMedia.push(...adMedia.map(media => ({
        path: media.media_url,
        type: media.media_type || getMediaTypeFromPath(media.media_url),
        alt: media.caption || ad.title
      })));
    }

    return allMedia[index] || null;
  };

  // 모든 미디어 가져오기
  const getAllMedia = () => {
    const allMedia = [];

    // 메인 이미지가 있으면 추가 (Supabase는 image_url 사용)
    if (ad?.image_url) {
      allMedia.push({
        path: ad.image_url,
        type: getMediaTypeFromPath(ad.image_url),
        alt: ad.image_alt || ad.title
      });
    }

    // 추가 미디어 추가
    if (adMedia && adMedia.length > 0) {
      allMedia.push(...adMedia.map(media => ({
        path: media.media_url,
        type: media.media_type || getMediaTypeFromPath(media.media_url),
        alt: media.caption || ad.title
      })));
    }

    return allMedia;
  };

  const getTotalMediaCount = () => {
    let count = 0;
    if (ad?.image_url) count++;
    if (adMedia && adMedia.length > 0) count += adMedia.length;
    return count;
  };

  const navigateMedia = (direction) => {
    const totalCount = getTotalMediaCount();
    if (totalCount <= 1) return;
    
    setCurrentMediaIndex(prev => {
      if (direction > 0) {
        return (prev + 1) % totalCount;
      } else {
        return prev === 0 ? totalCount - 1 : prev - 1;
      }
    });
  };

  // 미디어 인덱스 변경 시 비디오 자동 재생
  useEffect(() => {
    const currentMedia = getCurrentMedia();
    if (currentMedia?.type?.startsWith('video')) {
      // 짧은 딸레이 후 비디오 엘리먼트 찾아서 재생
      setTimeout(() => {
        const videoElement = document.querySelector('video');
        if (videoElement) {
          videoElement.currentTime = 0;
          videoElement.play().catch(() => {
            // AbortError는 정상적인 상황 (스크롤/전환 중 발생)
          });
        }
      }, 100);
    }
  }, [currentMediaIndex]);

  // 게시글 상태에서 자동 미디어 순환 (동영상 포함)
  useEffect(() => {
    if (!showLandingModal && ad) {
      const allMedia = [];
      if (ad?.image_url) {
        allMedia.push({ type: getMediaTypeFromPath(ad.image_url) });
      }
      if (adMedia && adMedia.length > 0) {
        allMedia.push(...adMedia.map(media => ({
          type: media.media_type || getMediaTypeFromPath(media.media_url)
        })));
      }

      // 전체 미디어가 2개 이상일 때만 자동 순환
      if (allMedia.length > 1) {
        const currentMedia = allMedia[currentMediaIndex];

        // 현재 미디어가 동영상이면 자동 순환 안 함 (동영상은 onEnded로 처리)
        if (currentMedia?.type?.startsWith('video')) {
          return;
        }

        // 이미지일 때만 3초 후 다음으로
        const timeout = setTimeout(() => {
          setCurrentMediaIndex(prev => (prev + 1) % allMedia.length);
        }, 3000);

        return () => clearTimeout(timeout);
      }
    }
  }, [showLandingModal, ad, adMedia, currentMediaIndex]);

  // 외부 광고(카드)에서 동영상 종료 시 다음 미디어로 이동
  const handleCardVideoEnded = () => {
    const totalCount = getTotalMediaCount();
    if (totalCount > 1) {
      setCurrentMediaIndex(prev => (prev + 1) % totalCount);
    }
    setIsVideoPlaying(false);
  };

  // 모달 내 자동 순환 (이미지만, 동영상은 onEnded로 처리)
  useEffect(() => {
    if (showLandingModal) {
      const allMedia = getAllMedia();
      if (allMedia.length <= 1) return;

      const currentMedia = allMedia[modalMediaIndex];

      // 현재 미디어가 동영상이면 자동 순환 안 함 (동영상은 onEnded로 처리)
      if (currentMedia?.type?.startsWith('video')) {
        return;
      }

      // 이미지일 때 3초 후 다음으로
      const timeout = setTimeout(() => {
        setModalMediaIndex(prev => (prev + 1) % allMedia.length);
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [showLandingModal, modalMediaIndex, adMedia]);

  // 모달 동영상 종료 시 다음 미디어로 이동
  const handleModalVideoEnded = () => {
    const allMedia = getAllMedia();
    if (allMedia.length > 1) {
      setModalMediaIndex(prev => (prev + 1) % allMedia.length);
    }
  };

  // 광고 클릭 핸들러
  const handleAdClick = () => {
    if (!ad) return;

    // 클릭 추적
    adService.trackAdClick(ad.id).catch(err => {
      console.warn('광고 클릭 추적 실패:', err);
    });

    // 외부 링크가 있으면 바로 이동
    if (ad.link_url) {
      window.open(ad.link_url, '_blank');
      return;
    }

    // 외부 링크가 없으면 모달로 열기
    setModalVideoMuted(false);
    setModalMediaIndex(0); // 첫 번째 미디어부터 시작
    setShowLandingModal(true);

    // body 스크롤 방지
    document.body.style.overflow = 'hidden';
  };

  // 모달 닫기
  const closeLandingModal = () => {
    setShowLandingModal(false);
    // 모달 비디오 정지 및 음소거 상태 초기화
    const modalVideos = document.querySelectorAll('.landing-modal video');
    modalVideos.forEach(video => {
      video.pause();
      video.currentTime = 0;
    });
    // 다음 모달 열 때를 위해 음소거 해제 상태로 초기화
    setModalVideoMuted(false);

    // body 스크롤 복원
    document.body.style.overflow = 'auto';
  };

  // PC에서는 광고 숨김
  if (!shouldShowAds() || !ad) return null;

  return (
    <div ref={adCardRef} className="w-full max-w-md mx-auto mb-6">
      {/* 인스타그램 스타일 광고 카드 */}
      <div className="bg-white rounded-xl overflow-hidden shadow-lg"
           style={{
             boxShadow: '-4px 0 15px rgba(255, 165, 0, 0.3), 0 4px 15px rgba(0, 0, 0, 0.1)'
           }}>
        
        {/* 광고 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">AD</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">스폰서</span>
          </div>
          <span className="text-xs text-gray-500">광고</span>
        </div>

        {/* 메인 미디어 */}
        <div 
          className="relative bg-gray-100 cursor-pointer overflow-hidden aspect-square"
          onClick={handleAdClick}
        >
          {/* 미디어 예시 */}
          {getCurrentMedia() ? (
            <div className="absolute inset-0">
              {getCurrentMedia().type?.startsWith('video') ? (
                <div className="absolute inset-0">
                  <video
                    ref={videoRef}
                    src={getImageUrl(getCurrentMedia().path)}
                    className="absolute inset-0 w-full h-full object-contain"
                    autoPlay
                    muted
                    playsInline
                    loop
                    onError={(e) => {
                      console.error('비디오 로드 오류:', e);
                    }}
                    onLoadedData={(e) => {
                      // 비디오가 로드되면 자동 재생 시도
                      e.target.play().catch(error => {
                        console.log('자동 재생 실패 (브라우저 정책):', error);
                      });
                    }}
                    onPlay={() => setIsVideoPlaying(true)}
                    onPause={() => setIsVideoPlaying(false)}
                  />
                  
                  {/* 비디오 재생 상태 오버레이 */}
                  {!isVideoPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="bg-white/90 rounded-full p-3">
                        <svg 
                          className="w-8 h-8 text-gray-800" 
                          fill="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <img 
                  src={getImageUrl(getCurrentMedia().path)}
                  alt={getCurrentMedia().alt || ad.title}
                  className="absolute inset-0 w-full h-full object-contain hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    e.target.src = DEFAULT_AD_IMAGE;
                  }}
                />
              )}
              
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <div className="text-center">
                <div className="text-4xl mb-2">📷</div>
                <div className="text-gray-500 text-sm">이미지 없음</div>
              </div>
            </div>
          )}
          
          {/* 오버레이 그라데이션 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
        </div>
        
        {/* 콘텐츠 영역 */}
        <div className="p-4">
          {/* 제목 */}
          <h3 className="text-base font-bold text-gray-900 mb-2 leading-tight">
            {ad.title}
          </h3>
          
          {/* 내용 */}
          {ad.content && (
            <p className="text-sm text-gray-700 mb-3 leading-relaxed line-clamp-3">
              {ad.content.replace(/<[^>]*>/g, '')}
            </p>
          )}
          
          {/* 액션 버튼 */}
          <button 
            onClick={handleAdClick}
            className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold py-3 px-4 rounded-lg hover:from-orange-600 hover:to-pink-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            자세히 보기
          </button>
        </div>
      </div>

      {/* 랜딩페이지 모달 */}
      {showLandingModal && (
        <>
          {/* 하단 메뉴 비활성화를 위한 오버레이 */}
          <div className="fixed bottom-0 left-0 right-0 h-20 bg-transparent z-[9999] pointer-events-none"></div>
          
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] landing-modal">
            <div className="bg-white w-full h-full flex flex-col overflow-hidden sm:rounded-lg sm:max-w-md sm:h-auto sm:max-h-[calc(100vh-4rem)] sm:mx-4">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-gradient-to-r from-orange-400 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">AD</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{ad.title}</h3>
              </div>
              <button 
                onClick={closeLandingModal}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* 모달 콘텐츠 */}
            <div className="p-4 overflow-y-auto flex-1">
              {/* 미디어 표시 (자동 순환) */}
              {getModalMedia(modalMediaIndex) && (
                <div className="mb-4">
                  {getModalMedia(modalMediaIndex).type?.startsWith('video') ? (
                    <div className="relative">
                      <video
                        key={modalMediaIndex}
                        src={getImageUrl(getModalMedia(modalMediaIndex).path)}
                        className="w-full h-auto object-contain rounded-lg"
                        controls
                        muted={modalVideoMuted}
                        autoPlay
                        playsInline
                        preload="metadata"
                        onEnded={handleModalVideoEnded}
                        onLoadedData={(e) => {
                          e.target.muted = modalVideoMuted;
                          e.target.play().catch(() => {});
                        }}
                        onCanPlay={(e) => {
                          e.target.muted = modalVideoMuted;
                          e.target.play().catch(() => {});
                        }}
                      />

                      {/* 음소거 토글 버튼 */}
                      <button
                        onClick={() => setModalVideoMuted(!modalVideoMuted)}
                        className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
                        title={modalVideoMuted ? '음소거 해제' : '음소거'}
                      >
                        {modalVideoMuted ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  ) : (
                    <img
                      key={modalMediaIndex}
                      src={getImageUrl(getModalMedia(modalMediaIndex).path)}
                      alt={getModalMedia(modalMediaIndex).alt || ad.title}
                      className="w-full h-auto object-contain rounded-lg"
                      onError={(e) => {
                        e.target.src = DEFAULT_AD_IMAGE;
                      }}
                    />
                  )}
                </div>
              )}

              {/* 광고 내용 */}
              {ad.content && (
                <div className="mb-4">
                  <h4 className="text-md font-semibold text-gray-900 mb-2">광고 내용</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {ad.content.replace(/<[^>]*>/g, '')}
                  </p>
                </div>
              )}

              {/* 외부 링크 섹션 */}
              {ad.link_url && (
                <div className="mb-4">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800 mb-2 break-all">{ad.link_url}</p>
                    <button
                      onClick={() => window.open(ad.link_url, '_blank')}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold py-2 px-4 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
                    >
                      자세히 보기
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* 모달 액션 */}
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={closeLandingModal}
                className="w-full bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-600 transition-all duration-200"
              >
                닫기
              </button>
            </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MobileAdDisplay;