import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { shouldShowAds } from '../utils/deviceDetector';
import { getImageUrl, DEFAULT_AD_IMAGE } from '../config/api';
import { adService } from '../services';
import { isCloudflareStreamUrl, getCloudflareStreamUid } from '../utils/mediaUtils';
import CloudflareStreamPlayer from './CloudflareStreamPlayer';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { supabase } from '../config/supabase.js';
import AdPollCard from './ad/AdPollCard';
import adPollService from '../services/adPollService.js';
import { changeVariant, IMAGE_VARIANTS } from '../services/cfImagesService';

/** Cloudflare Images URL의 variant를 모바일 최적화 크기로 변환 (public → medium/640px) */
const toSmallVariant = (url) => {
  if (!url || !url.includes('imagedelivery.net')) return url;
  return changeVariant(url, IMAGE_VARIANTS.MEDIUM);
};

const MobileAdDisplay = ({ ad }) => {
  const [adMedia, setAdMedia] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [showLandingModal, setShowLandingModal] = useState(false);
  const [modalVideoMuted, setModalVideoMuted] = useState(false); // false = 음소거 해제
  const [modalMediaIndex, setModalMediaIndex] = useState(0); // 모달 내 미디어 인덱스
  const [isVisible, setIsVisible] = useState(false);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false); // IAB 표준 노출 추적
  const videoRef = useRef(null);
  const adCardRef = useRef(null);
  const impressionTimerRef = useRef(null); // 노출 타이머
  const scrollYRef = useRef(0); // 스크롤 위치 저장
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();

  // ── 투표(Poll) 관련 state ──
  const [pollData, setPollData] = useState(ad?.ad_polls || null);
  const [myPollVotes, setMyPollVotes] = useState([]);
  const [isVoting, setIsVoting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const pollSubRef = useRef(null);

  // 현재 유저 ID 가져오기
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  // 내 투표 로드 (로그인/비로그인 모두 — 서비스에서 session_id fallback)
  useEffect(() => {
    if (pollData?.id) {
      adPollService.getMyVotes(pollData.id).then(setMyPollVotes).catch(() => {});
    }
  }, [pollData?.id, currentUserId]);

  // 실시간 투표 구독
  useEffect(() => {
    if (!pollData?.id) return;
    pollSubRef.current = adPollService.subscribeToVotes(async (payload) => {
      const pid = payload.new?.poll_id || payload.old?.poll_id;
      if (pid === pollData.id) {
        try {
          const updated = await adPollService.getPollData(pid);
          setPollData(updated);
        } catch { /* ignore */ }
      }
    });
    return () => pollSubRef.current?.unsubscribe();
  }, [pollData?.id]);

  // 투표 핸들러 (옵티미스틱 UI + rollback, 비로그인도 session_id로 가능)
  const handlePollVote = useCallback(async (pollId, optionId) => {
    if (isVoting) return;
    setIsVoting(true);
    const prevVotes = [...myPollVotes];
    // 옵티미스틱 업데이트
    setMyPollVotes((prev) => {
      if (prev.includes(optionId)) return prev.filter((id) => id !== optionId);
      if (!pollData?.is_multiple) return [optionId];
      return [...prev, optionId];
    });
    try {
      await adPollService.toggleVote(pollId, optionId, pollData?.is_multiple);
      // 최신 데이터 반영
      const updated = await adPollService.getPollData(pollId);
      setPollData(updated);
    } catch {
      // rollback
      setMyPollVotes(prevVotes);
    } finally {
      setIsVoting(false);
    }
  }, [isVoting, myPollVotes, pollData?.is_multiple]);

  // pwa-install 광고인데 이미 설치된 환경이면 렌더링 안 함
  const isPWAInstallAd = ad?.link_url === 'pwa-install';
  if (isPWAInstallAd && isInstalled) return null;

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


  // Intersection Observer로 스크롤 시 동영상 자동 재생/정지 + IAB 표준 노출 추적
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);

          // 동영상 재생/정지 (기존 로직 유지)
          if (videoRef.current) {
            if (entry.isIntersecting) {
              videoRef.current.play().catch(() => {});
            } else {
              videoRef.current.pause();
            }
          }

          // IAB 표준 노출 추적: 50% 이상 보이고 1초 이상 지속 시 카운트
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // 50% 이상 보일 때 1초 타이머 시작
            if (!hasTrackedImpression && !impressionTimerRef.current && ad?.id) {
              impressionTimerRef.current = setTimeout(() => {
                adService.trackAdImpression(ad.id).catch(() => {});
                setHasTrackedImpression(true);
              }, 1000); // 1초 후 카운트
            }
          } else {
            // 화면에서 벗어나면 타이머 취소
            if (impressionTimerRef.current) {
              clearTimeout(impressionTimerRef.current);
              impressionTimerRef.current = null;
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
      // 타이머 정리
      if (impressionTimerRef.current) {
        clearTimeout(impressionTimerRef.current);
      }
    };
  }, [currentMediaIndex, hasTrackedImpression, ad]); // 의존성 추가

  // 파일 확장자로 미디어 타입 판단
  const getMediaTypeFromPath = (path, mediaType) => {
    if (!path) return 'image';
    // DB에 저장된 media_type이 'stream'인 경우
    if (mediaType === 'stream') return 'stream';
    // Cloudflare Stream URL인 경우
    if (isCloudflareStreamUrl(path)) return 'stream';
    // UID만 저장된 경우 (32자 hex 형식) - Stream으로 판단
    if (/^[a-f0-9]{32}$/.test(path)) return 'stream';
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
        type: getMediaTypeFromPath(ad.image_url, ad.image_type),
        alt: ad.image_alt || ad.title
      });
    }

    // 추가 미디어 추가
    if (adMedia && adMedia.length > 0) {
      allMedia.push(...adMedia.map(media => ({
        path: media.media_url,
        type: getMediaTypeFromPath(media.media_url, media.media_type),
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
        type: getMediaTypeFromPath(ad.image_url, ad.image_type),
        alt: ad.image_alt || ad.title
      });
    }

    // 추가 미디어 추가
    if (adMedia && adMedia.length > 0) {
      allMedia.push(...adMedia.map(media => ({
        path: media.media_url,
        type: getMediaTypeFromPath(media.media_url, media.media_type),
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
        type: getMediaTypeFromPath(ad.image_url, ad.image_type),
        alt: ad.image_alt || ad.title
      });
    }

    // 추가 미디어 추가
    if (adMedia && adMedia.length > 0) {
      allMedia.push(...adMedia.map(media => ({
        path: media.media_url,
        type: getMediaTypeFromPath(media.media_url, media.media_type),
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
    if (!showLandingModal) return;

    const allMedia = getAllMedia();
    if (allMedia.length <= 1) return;

    const currentMedia = allMedia[modalMediaIndex];

    // 현재 미디어가 동영상이면 자동 순환 안 함 (동영상은 onEnded로 처리)
    // video 타입 체크 강화
    if (currentMedia?.type === 'video' || currentMedia?.type?.startsWith('video')) {
      return; // 동영상일 때는 타이머 설정 안 함
    }

    // 이미지일 때만 3초 후 다음으로
    const timeout = setTimeout(() => {
      setModalMediaIndex(prev => (prev + 1) % allMedia.length);
    }, 3000);

    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLandingModal, modalMediaIndex]); // adMedia 의존성 제거 - 무한 리렌더링 방지

  // 모달 동영상 종료 시 다음 미디어로 이동
  const handleModalVideoEnded = () => {
    const allMedia = getAllMedia();
    if (allMedia.length > 1) {
      setModalMediaIndex(prev => (prev + 1) % allMedia.length);
    }
  };

  // 광고 클릭 핸들러 (항상 모달로 열기)
  const handleAdClick = async () => {
    if (!ad) return;

    // 클릭 추적
    adService.trackAdClick(ad.id).catch(() => {});

    // PWA 설치 광고: Android는 네이티브 설치, iOS는 모달로 안내
    if (isPWAInstallAd && canInstall) {
      try {
        await promptInstall();
      } catch {
        // hook에서 이미 에러 처리됨 — 방어적 catch
      }
      return;
    }

    // 스크롤 위치 저장 및 배경 스크롤 잠금
    scrollYRef.current = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollYRef.current}px`;

    // 항상 모달로 열기 (링크 유무와 관계없이)
    setModalVideoMuted(false);
    setModalMediaIndex(0); // 첫 번째 미디어부터 시작
    setShowLandingModal(true);
  };

  // 모달 미디어 클릭 핸들러 (링크로 이동)
  const handleModalMediaClick = () => {
    if (isPWAInstallAd) return; // iOS 안내 모달에서는 링크 이동 불필요
    if (ad?.link_url) {
      window.open(ad.link_url, '_blank');
    }
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

    // 배경 스크롤 복원
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
    window.scrollTo(0, scrollYRef.current);
  };

  // PC에서는 광고 숨김
  if (!shouldShowAds() || !ad) return null;

  return (
    <div ref={adCardRef} className="w-full max-w-md mx-auto mb-6">
      {/* 인스타그램 스타일 광고 카드 */}
      <div className="bg-base-100 rounded-xl overflow-hidden shadow-lg"
           style={{
             boxShadow: '-4px 0 15px rgba(255, 165, 0, 0.3), 0 4px 15px rgba(0, 0, 0, 0.1)'
           }}>
        
        {/* 광고 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">AD</span>
            </div>
            <span className="text-base font-bold text-base-content line-clamp-1">{ad.title}</span>
          </div>
          <span className="text-xs text-base-content/50">광고</span>
        </div>

        {/* 메인 미디어 */}
        <div
          className="relative bg-base-200 cursor-pointer overflow-hidden aspect-square"
          onClick={handleAdClick}
        >
          {/* 미디어 예시 */}
          {getCurrentMedia() ? (
            <div className="absolute inset-0">
              {getCurrentMedia().type === 'stream' ? (
                // Cloudflare Stream 동영상 - 피드에서는 무음, 터치 시 상세 모달로 이동
                <div className="absolute inset-0">
                  <CloudflareStreamPlayer
                    uid={getCloudflareStreamUid(getCurrentMedia().path) || getCurrentMedia().path}
                    autoplay={isVisible}
                    muted={true}
                    loop={true}
                    controls={false}
                    aspectRatio="square"
                    hideOverlay={true}
                    onClick={handleAdClick}
                  />
                </div>
              ) : getCurrentMedia().type?.startsWith('video') ? (
                <div className="absolute inset-0">
                  <video
                    ref={videoRef}
                    src={getImageUrl(getCurrentMedia().path)}
                    className="absolute inset-0 w-full h-full object-contain"
                    autoPlay
                    muted
                    playsInline
                    loop
                    preload="auto"
                    onError={() => {}}
                    onLoadedData={(e) => {
                      e.target.play().catch(() => {});
                    }}
                    onPlay={() => setIsVideoPlaying(true)}
                    onPause={() => setIsVideoPlaying(false)}
                  />

                  {/* 비디오 재생 상태 오버레이 */}
                  {!isVideoPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="bg-white/90 rounded-full p-3">
                        <svg
                          className="w-8 h-8 text-neutral"
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
                  src={toSmallVariant(getImageUrl(getCurrentMedia().path))}
                  alt={getCurrentMedia().alt || ad.title}
                  className="absolute inset-0 w-full h-full object-contain hover:scale-105 transition-transform duration-300"
                  loading="eager"
                  fetchpriority="high"
                  onError={(e) => {
                    e.target.src = DEFAULT_AD_IMAGE;
                  }}
                />
              )}

            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-base-200 to-base-300">
              <div className="text-center">
                <div className="text-4xl mb-2">📷</div>
                <div className="text-base-content/50 text-sm">이미지 없음</div>
              </div>
            </div>
          )}
        </div>
        
        {/* 콘텐츠 영역 */}
        <div className="p-4">
          {/* 제목 */}
          <h3 className="text-base font-bold text-base-content mb-2 leading-tight">
            {ad.title}
          </h3>
          
          {/* 내용 */}
          {ad.content && (
            <p className="text-sm text-base-content/70 mb-3 leading-relaxed whitespace-pre-wrap line-clamp-2">
              {ad.content.replace(/<[^>]*>/g, '')}
            </p>
          )}

          {/* 광고 투표 */}
          {pollData && (
            <AdPollCard
              poll={pollData}
              myVotes={myPollVotes}
              onVote={handlePollVote}
              isVoting={isVoting}
              currentUserId={currentUserId}
            />
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

      {/* 랜딩페이지 모달 - Portal로 document.body에 렌더링 */}
      {showLandingModal && createPortal(
        <>
          {/* 하단 메뉴 비활성화를 위한 오버레이 */}
          <div className="fixed bottom-0 left-0 right-0 h-20 bg-transparent z-[9999] pointer-events-none"></div>

          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] landing-modal">
            <div className="bg-base-100 w-full h-full flex flex-col overflow-hidden sm:rounded-lg sm:max-w-md sm:h-auto sm:max-h-[calc(100vh-4rem)] sm:mx-4">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between py-2 px-4 border-b">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-gradient-to-r from-orange-400 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">AD</span>
                </div>
                <h3 className="text-lg font-bold text-base-content">{ad.title}</h3>
              </div>
              <button
                onClick={closeLandingModal}
                className="text-base-content/50 hover:text-base-content/70 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* 모달 콘텐츠 */}
            <div className="p-4 overflow-y-auto flex-1">
              {/* 미디어 표시 (자동 순환) - 링크가 있으면 클릭 시 이동 */}
              {getModalMedia(modalMediaIndex) && (
                <div
                  className={`mb-4 relative ${ad.link_url ? 'cursor-pointer' : ''}`}
                  onClick={ad.link_url ? handleModalMediaClick : undefined}
                >
                  {getModalMedia(modalMediaIndex).type === 'stream' ? (
                    // Cloudflare Stream 동영상 - 모달에서는 오디오 토글 버튼만 클릭 가능
                    <div className="relative rounded-lg overflow-hidden">
                      <div onClick={(e) => ad.link_url && e.stopPropagation()}>
                        <CloudflareStreamPlayer
                          uid={getCloudflareStreamUid(getModalMedia(modalMediaIndex).path) || getModalMedia(modalMediaIndex).path}
                          autoplay={true}
                          muted={modalVideoMuted}
                          controls={false}
                          aspectRatio="auto"
                          hideOverlay={true}
                          disableClickToggle={true}
                        />
                      </div>
                      {/* 음소거 토글 버튼 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalVideoMuted(!modalVideoMuted);
                        }}
                        className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 z-10"
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
                      {/* 링크 클릭 오버레이 */}
                      {ad.link_url && (
                        <div
                          className="absolute inset-0 z-[5]"
                          onClick={handleModalMediaClick}
                        />
                      )}
                    </div>
                  ) : getModalMedia(modalMediaIndex).type?.startsWith('video') ? (
                    <div className="relative">
                      <video
                        key={modalMediaIndex}
                        src={getImageUrl(getModalMedia(modalMediaIndex).path)}
                        className="w-full h-auto object-contain rounded-lg"
                        muted={modalVideoMuted}
                        autoPlay
                        playsInline
                        preload="auto"
                        onEnded={handleModalVideoEnded}
                        onLoadedData={(e) => {
                          e.target.muted = modalVideoMuted;
                          e.target.play().catch(() => {});
                        }}
                      />

                      {/* 음소거 토글 버튼 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalVideoMuted(!modalVideoMuted);
                        }}
                        className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 z-10"
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
                  {/* 링크 있을 때 안내 표시 (pwa-install 제외) */}
                  {ad.link_url && !isPWAInstallAd && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                      탭하여 상세보기
                    </div>
                  )}
                </div>
              )}

              {/* 광고 내용 */}
              {ad.content && (
                <div className="mb-4">
                  <p className="text-base text-base-content/70 leading-relaxed whitespace-pre-wrap">
                    {ad.content.replace(/<[^>]*>/g, '')}
                  </p>
                </div>
              )}

              {/* 모달 내 광고 투표 */}
              {pollData && (
                <div className="mb-4">
                  <AdPollCard
                    poll={pollData}
                    myVotes={myPollVotes}
                    onVote={handlePollVote}
                    isVoting={isVoting}
                    currentUserId={currentUserId}
                  />
                </div>
              )}

              {/* 외부 링크 섹션 */}
              {ad.link_url && !isPWAInstallAd && (
                <div className="mb-4">
                  <div className="p-3">
                    <p className="text-sm text-base-content/50 mb-2 break-all">{ad.link_url}</p>
                    <button
                      onClick={() => window.open(ad.link_url, '_blank')}
                      className="w-full bg-teal-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-teal-700 transition-all duration-200"
                    >
                      상세보기
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* 모달 액션 */}
            <div className="p-4 border-t bg-base-200">
              <button
                onClick={closeLandingModal}
                className="w-full bg-base-300 text-base-content font-semibold py-2 px-4 rounded-lg hover:bg-base-content/20 transition-all duration-200"
              >
                닫기
              </button>
            </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default MobileAdDisplay;