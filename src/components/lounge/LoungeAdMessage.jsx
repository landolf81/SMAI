/**
 * LoungeAdMessage.jsx
 * 역할: 광장 피드 내 메시지형 경량 광고 컴포넌트
 * LoungeMessage와 동일한 레이아웃으로 자연스럽게 삽입
 * 이미지 / 일반 동영상 / Cloudflare Stream 동영상 지원
 * 사용 위치: Lounge.jsx (15개 메시지마다 1개 삽입)
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { adService } from '../../services';
import { getImageUrl } from '../../config/api';
import { isCloudflareStreamUrl, getCloudflareStreamUid, isVideoFile } from '../../utils/mediaUtils';
import CloudflareStreamPlayer from '../CloudflareStreamPlayer';

/** HTML 태그 제거 */
const stripHtml = (html) => (html ? html.replace(/<[^>]*>/g, '') : '');

/** Cloudflare Images URL의 variant를 축소 */
const toSmallVariant = (url) => {
  if (!url || !url.includes('imagedelivery.net')) return url;
  return url.replace(/\/public$/, '/w=600');
};

/** 미디어 항목에서 첫 번째 항목의 타입 판별 */
const getMediaInfo = (media) => {
  if (!media?.media_url) return null;
  const url = media.media_url;
  if (isCloudflareStreamUrl(url)) {
    return { type: 'stream', url, uid: getCloudflareStreamUid(url) || url };
  }
  if (media.media_type === 'video' || isVideoFile(url)) {
    return { type: 'video', url };
  }
  return { type: 'image', url: toSmallVariant(getImageUrl(url)) };
};

const LoungeAdMessage = React.memo(({ ad, onImageClick }) => {
  const containerRef = useRef(null);
  const hasTrackedRef = useRef(false);
  const timerRef = useRef(null);
  const [firstMedia, setFirstMedia] = useState(null); // 첫 번째 미디어
  const [isVisible, setIsVisible] = useState(false);

  // pwa-install 광고는 렌더링 안 함
  if (ad?.link_url === 'pwa-install') return null;

  const content = stripHtml(ad.content);

  // image_url도 동영상/스트림일 수 있으므로 타입 판별
  const mainMedia = (() => {
    if (!ad.image_url) return null;
    const url = ad.image_url;
    if (isCloudflareStreamUrl(url)) {
      return { type: 'stream', url, uid: getCloudflareStreamUid(url) || url };
    }
    if (isVideoFile(url)) {
      return { type: 'video', url: getImageUrl(url) };
    }
    return { type: 'image', url: toSmallVariant(getImageUrl(url)) };
  })();

  // ── ad_media에서 첫 번째 미디어 로드 ──
  useEffect(() => {
    let cancelled = false;
    adService.getAdMedia(ad.id)
      .then((mediaList) => {
        if (!cancelled && Array.isArray(mediaList) && mediaList.length > 0) {
          setFirstMedia(getMediaInfo(mediaList[0]));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [ad.id]);

  // ── 노출 추적 (IAB: 50% visible + 1초) + 비디오 자동재생 ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting) {
          if (!hasTrackedRef.current) {
            timerRef.current = setTimeout(() => {
              hasTrackedRef.current = true;
              adService.trackAdImpression(ad.id);
            }, 1000);
          }
        } else {
          clearTimeout(timerRef.current);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timerRef.current);
    };
  }, [ad.id]);

  // ── 클릭 핸들러 ──
  const handleLinkClick = useCallback(() => {
    if (!ad.link_url) return;
    adService.trackAdClick(ad.id);
    window.open(ad.link_url, '_blank');
  }, [ad.id, ad.link_url]);

  const handleImageClick = useCallback(() => {
    adService.trackAdClick(ad.id);
    if (firstMedia?.type === 'image') {
      onImageClick?.(firstMedia.url);
    } else if (mainMedia?.type === 'image') {
      onImageClick?.(mainMedia.url);
    }
  }, [ad.id, firstMedia, mainMedia, onImageClick]);

  // 표시할 미디어 결정: ad_media 우선, 없으면 image_url fallback
  const displayMedia = firstMedia || mainMedia;

  return (
    <div
      ref={containerRef}
      className="flex items-start gap-2.5 px-4 py-2 border-b border-gray-200/60 bg-orange-50/30 border-l-2 border-l-orange-300"
    >
      {/* AD 아바타 */}
      <div className="w-9 h-9 rounded-full flex-shrink-0 mt-0.5 bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
        <span className="text-[11px] font-extrabold text-white leading-none">AD</span>
      </div>

      <div className="flex-1 min-w-0">
        {/* 헤더: 광고 뱃지 + 타이틀 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-semibold text-gray-800 truncate">
            {ad.title || '광고'}
          </span>
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none bg-orange-500 text-white ml-0.5 flex-shrink-0"
            title="광고"
          >
            광고
          </span>
        </div>

        {/* 본문 텍스트 */}
        {content && (
          <p className="text-[16px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words mt-0.5 line-clamp-3">
            {content}
          </p>
        )}

        {/* 미디어 (이미지 / 동영상 / Cloudflare Stream) */}
        {displayMedia && (
          <div className="mt-1.5 max-w-[280px]">
            {displayMedia.type === 'stream' && (
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <CloudflareStreamPlayer
                  uid={displayMedia.uid}
                  autoplay={isVisible}
                  muted={true}
                  loop={true}
                  controls={true}
                  className="w-full"
                />
              </div>
            )}
            {displayMedia.type === 'video' && (
              <video
                src={displayMedia.url}
                className="rounded-xl max-w-full max-h-[240px] object-cover border border-gray-200"
                autoPlay={isVisible}
                muted
                loop
                playsInline
                controls
              />
            )}
            {displayMedia.type === 'image' && (
              <img
                src={displayMedia.url}
                alt={ad.title || '광고 이미지'}
                className="rounded-xl max-w-[240px] max-h-[240px] object-cover cursor-pointer border border-gray-200"
                loading="lazy"
                onClick={handleImageClick}
              />
            )}
          </div>
        )}

        {/* 링크 버튼 */}
        {ad.link_url && ad.link_url !== 'pwa-install' && (
          <button
            onClick={handleLinkClick}
            className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full active:bg-orange-100 transition-colors"
          >
            자세히 보기
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});

LoungeAdMessage.displayName = 'LoungeAdMessage';
export default LoungeAdMessage;
