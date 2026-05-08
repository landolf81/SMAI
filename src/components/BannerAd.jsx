import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { bannerAdService } from '../services/bannerAdService';
import { changeVariant, IMAGE_VARIANTS } from '../services/cfImagesService';

/**
 * BannerAd
 * - slot 하나에 대한 활성 배너 광고를 1개 가져와 렌더링
 * - 화면에 50% 이상 1초 이상 보이면 impression 1회 추적 (IntersectionObserver)
 * - 클릭 시 내부(/sponsor/:slug) 또는 외부 링크 이동
 * - 로딩 중: 동일 비율 스켈레톤 자리 점유 (CLS 방지)
 * - 로드 완료 후 광고 없음: fallback 이미지 표시 (없으면 null)
 *
 * Props:
 *  - slot: BANNER_SLOTS 중 하나 (필수)
 *  - className: 외곽 wrapper 클래스 (선택)
 *  - aspectRatio: 컨테이너 비율 (기본 '8/3' = 모바일 배너)
 *  - rounded: 모서리 둥글기 (기본 'rounded-xl')
 *  - fallbackImage: 광고 없을 때 표시할 기본 이미지 경로 (기본 '/images/banner-fallback.png')
 */
const DEFAULT_FALLBACK_IMAGE = '/images/banner-fallback.png';
const toMediumVariant = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('imagedelivery.net')) return url;
  try {
    return changeVariant(url, IMAGE_VARIANTS.MEDIUM);
  } catch {
    return url;
  }
};

const BannerAd = ({
  slot,
  className = '',
  aspectRatio = '8/3',
  rounded = 'rounded-xl',
  rotateMs = 4000,
  fallbackImage = DEFAULT_FALLBACK_IMAGE,
}) => {
  const [ad, setAd] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const containerRef = useRef(null);
  const impressionTimerRef = useRef(null);
  const trackedRef = useRef(false);
  const navigate = useNavigate();

  // 광고 fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await bannerAdService.getActiveAdBySlot(slot);
      if (!cancelled) {
        setAd(data);
        setLoaded(true);
        setImgIndex(0);
      }
    })();
    return () => { cancelled = true; };
  }, [slot]);

  // 다중 이미지 자동 회전
  const images = useMemo(() => {
    if (!ad) return [];
    return Array.isArray(ad.images) && ad.images.length > 0
      ? ad.images
      : (ad.image_url ? [ad.image_url] : []);
  }, [ad]);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      setImgIndex(i => (i + 1) % images.length);
    }, rotateMs);
    return () => clearInterval(id);
  }, [images.length, rotateMs]);

  // IntersectionObserver — 50% 이상 1초 노출 시 카운트
  useEffect(() => {
    if (!ad?.id || !containerRef.current) return;
    const el = containerRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (!trackedRef.current && !impressionTimerRef.current) {
              impressionTimerRef.current = setTimeout(() => {
                if (!trackedRef.current) {
                  trackedRef.current = true;
                  bannerAdService.trackImpression(ad.id, 'banner').catch(() => {});
                }
                impressionTimerRef.current = null;
              }, 1000);
            }
          } else if (impressionTimerRef.current) {
            clearTimeout(impressionTimerRef.current);
            impressionTimerRef.current = null;
          }
        });
      },
      { threshold: [0, 0.5, 1] }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (impressionTimerRef.current) {
        clearTimeout(impressionTimerRef.current);
        impressionTimerRef.current = null;
      }
    };
  }, [ad?.id]);

  const handleClick = useCallback((e) => {
    e.preventDefault();
    if (!ad?.id) return;
    bannerAdService.trackClick(ad.id).catch(() => {});

    // 우선순위: external_url > /sponsor/:slug
    if (ad.external_url) {
      const url = ad.external_url;
      if (url.startsWith('/')) {
        navigate(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } else if (ad.landing_slug) {
      navigate(`/sponsor/${ad.landing_slug}`);
    }
  }, [ad, navigate]);

  // 로드 완료 + 광고 없음 → fallback 이미지 (없으면 null)
  if (loaded && (!ad || images.length === 0)) {
    if (!fallbackImage) return null;
    return (
      <div className={`w-full ${className}`}>
        <div
          className={`relative w-full bg-base-200 overflow-hidden ${rounded}`}
          style={{ aspectRatio }}
        >
          <img
            src={fallbackImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            aria-hidden="true"
          />
        </div>
      </div>
    );
  }

  // 로딩 중 → 동일 비율 스켈레톤 (CLS 방지)
  if (!loaded) {
    return (
      <div className={`w-full ${className}`}>
        <div
          className={`relative w-full bg-base-300 overflow-hidden ${rounded} animate-pulse`}
          style={{ aspectRatio }}
          aria-hidden="true"
        />
      </div>
    );
  }

  const hasLink = !!(ad.external_url || ad.landing_slug);

  // 다중 이미지를 모두 absolute로 깔고 현재 인덱스만 opacity-100, 나머지 opacity-0 (페이드 전환)
  const imageStack = (
    <>
      {images.map((src, idx) => (
        <img
          key={`${src}-${idx}`}
          src={toMediumVariant(src)}
          alt={ad.alt_text || ad.title || ad.name || '광고'}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            idx === imgIndex ? 'opacity-100' : 'opacity-0'
          }`}
          loading={idx === 0 ? 'eager' : 'lazy'}
          decoding="async"
        />
      ))}
    </>
  );

  // 다중일 때 페이지 인디케이터 (점)
  const indicators = images.length > 1 ? (
    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
      {images.map((_, idx) => (
        <span
          key={idx}
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            idx === imgIndex ? 'bg-white' : 'bg-white/40'
          }`}
        />
      ))}
    </div>
  ) : null;

  return (
    <div className={`w-full ${className}`}>
      <div
        ref={containerRef}
        className={`relative w-full bg-base-200 overflow-hidden ${rounded}`}
        style={{ aspectRatio }}
      >
        {hasLink ? (
          <a
            href={ad.external_url || `/sponsor/${ad.landing_slug}`}
            onClick={handleClick}
            className="absolute inset-0 block focus:outline-none focus:ring-2 focus:ring-orange-400"
            aria-label={ad.alt_text || ad.title || ad.name}
            target={ad.external_url && !ad.external_url.startsWith('/') ? '_blank' : undefined}
            rel={ad.external_url && !ad.external_url.startsWith('/') ? 'noopener noreferrer' : undefined}
          >
            {imageStack}
            <BannerOverlay ad={ad} />
            {indicators}
          </a>
        ) : (
          <div className="absolute inset-0">
            {imageStack}
            <BannerOverlay ad={ad} />
            {indicators}
          </div>
        )}
      </div>
    </div>
  );
};

const BannerOverlay = ({ ad }) => (
  <>
    {/* 광고 라벨 */}
    <span className="absolute top-1.5 left-1.5 bg-black/55 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
      광고
    </span>

    {/* CTA / 광고주명 표시 */}
    {(ad.cta_text || ad.advertiser_name) && (
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 flex items-center justify-between">
        <span className="text-white text-xs font-medium truncate">
          {ad.advertiser_name || ad.title || ''}
        </span>
        {ad.cta_text && (
          <span className="bg-white/95 text-base-content text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap shrink-0 ml-2">
            {ad.cta_text}
          </span>
        )}
      </div>
    )}
  </>
);

export default BannerAd;
