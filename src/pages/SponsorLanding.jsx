import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PhoneIcon from '@mui/icons-material/Phone';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LoadingSpinner from '../components/LoadingSpinner';
import { bannerAdService } from '../services/bannerAdService';
import { changeVariant, IMAGE_VARIANTS } from '../services/cfImagesService';

/**
 * SponsorLanding - 광고주 랜딩 페이지
 * 경로: /sponsor/:slug
 * - 활성/기간 내 광고만 노출 (RLS와 동일 조건)
 * - 진입 시 노출 추적 (source='landing')
 * - CTA 클릭 시 클릭 추적 + 외부 링크 이동
 */
const toLargeVariant = (url) => {
  if (!url || typeof url !== 'string' || !url.includes('imagedelivery.net')) return url;
  try {
    return changeVariant(url, IMAGE_VARIANTS.LARGE);
  } catch {
    return url;
  }
};

const SponsorLanding = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await bannerAdService.getAdBySlug(slug);
      if (cancelled) return;
      if (!data) {
        setNotFound(true);
      } else {
        setAd(data);
        // 랜딩 페이지 노출 추적
        bannerAdService.trackImpression(data.id, 'landing').catch(() => {});
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const handleCta = () => {
    if (!ad) return;
    bannerAdService.trackClick(ad.id).catch(() => {});
    if (ad.external_url) {
      if (ad.external_url.startsWith('/')) navigate(ad.external_url);
      else window.open(ad.external_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handlePhone = () => {
    if (!ad?.contact_phone) return;
    bannerAdService.trackClick(ad.id).catch(() => {});
    window.location.href = `tel:${ad.contact_phone}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 pt-16 pb-24 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (notFound || !ad) {
    return (
      <div className="min-h-screen bg-base-200 pt-16 pb-24">
        <div className="max-w-screen-md mx-auto p-6 text-center">
          <h1 className="text-xl font-bold text-base-content mb-2">광고를 찾을 수 없습니다</h1>
          <p className="text-base-content/60 mb-6">요청한 광고 페이지가 존재하지 않거나 종료되었습니다.</p>
          <button
            onClick={() => navigate(-1)}
            className="btn btn-primary"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 pt-14 pb-24">
      {/* 서브 헤더 */}
      <div className="bg-base-100 border-b border-base-300 sticky top-14 z-10">
        <div className="flex items-center px-4 py-3 max-w-screen-md mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-base-200 rounded-full transition-colors"
            aria-label="뒤로가기"
          >
            <ArrowBackIcon />
          </button>
          <h1 className="ml-2 text-base font-bold text-base-content truncate">
            {ad.title || ad.advertiser_name || '광고'}
          </h1>
          <span className="ml-auto text-[11px] bg-base-200 text-base-content/60 px-2 py-1 rounded-full">광고</span>
        </div>
      </div>

      <div className="max-w-screen-md mx-auto p-4 space-y-4">
        {/* 메인 이미지 */}
        <div className="bg-base-100 rounded-xl overflow-hidden shadow-sm">
          <img
            src={toLargeVariant(ad.image_url)}
            alt={ad.alt_text || ad.title || ad.name || '광고'}
            className="w-full h-auto object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </div>

        {/* 광고주/제목 */}
        <div className="bg-base-100 rounded-xl p-4 shadow-sm">
          {ad.advertiser_name && (
            <p className="text-sm text-base-content/60 mb-1">{ad.advertiser_name}</p>
          )}
          {ad.title && (
            <h2 className="text-lg font-bold text-base-content mb-3">{ad.title}</h2>
          )}
          {ad.body && (
            <p className="text-base text-base-content/80 leading-relaxed whitespace-pre-wrap">
              {ad.body}
            </p>
          )}
        </div>

        {/* CTA 영역 */}
        {(ad.external_url || ad.contact_phone) && (
          <div className="space-y-2">
            {ad.external_url && (
              <button
                onClick={handleCta}
                className="w-full bg-orange-500 text-white font-semibold py-3 px-4 rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <OpenInNewIcon style={{ fontSize: 20 }} />
                {ad.cta_text || '자세히 보기'}
              </button>
            )}
            {ad.contact_phone && (
              <button
                onClick={handlePhone}
                className="w-full bg-base-100 border border-base-300 text-base-content font-semibold py-3 px-4 rounded-xl hover:bg-base-200 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <PhoneIcon style={{ fontSize: 20 }} />
                {ad.contact_phone}
              </button>
            )}
          </div>
        )}

        {/* 안내 */}
        <p className="text-[11px] text-center text-base-content/50 pt-2">
          본 페이지는 유료 광고이며, 표시된 정보의 책임은 광고주에게 있습니다.
        </p>
      </div>
    </div>
  );
};

export default SponsorLanding;
