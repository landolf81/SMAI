import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bannerAdService } from '../services/bannerAdService';
import { changeVariant, IMAGE_VARIANTS } from '../services/cfImagesService';

/**
 * BannerAd
 * - slot 하나에 대한 활성 배너 광고를 1개 가져와 렌더링
 * - 화면에 50% 이상 1초 이상 보이면 impression 1회 추적 (IntersectionObserver)
 * - 클릭 시 내부(/sponsor/:slug) 또는 외부 링크 이동
 * - CLS 방지: 항상 고정 비율 컨테이너 점유 (광고가 없으면 className으로 0높이 처리)
 *
 * Props:
 *  - slot: BANNER_SLOTS 중 하나 (필수)
 *  - className: 외곽 wrapper 클래스 (선택)
 *  - aspectRatio: 컨테이너 비율 (기본 '8/3' = 모바일 배너)
 *  - rounded: 모서리 둥글기 (기본 'rounded-xl')
 */
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
}) => {
  const [ad, setAd] = useState(null);
  const [loaded, setLoaded] = useState(false);
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
      }
    })();
    return () => { cancelled = true; };
  }, [slot]);

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

  // 데이터 로드 전 또는 광고 없음 → 빈 슬롯 (CLS 방지를 위해 자리 차지하지 않음)
  if (!loaded || !ad) {
    return null;
  }

  const hasLink = !!(ad.external_url || ad.landing_slug);

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
            <img
              src={toMediumVariant(ad.image_url)}
              alt={ad.alt_text || ad.title || ad.name || '광고'}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <BannerOverlay ad={ad} />
          </a>
        ) : (
          <div className="absolute inset-0">
            <img
              src={toMediumVariant(ad.image_url)}
              alt={ad.alt_text || ad.title || ad.name || '광고'}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <BannerOverlay ad={ad} />
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
