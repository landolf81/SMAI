/**
 * LoungeImageScroll.jsx
 * 역할: 광장 메시지의 이미지 표시 — 단일/다중 이미지 호환
 * - 단일 이미지: 기존처럼 표시
 * - 다중 이미지: CSS scroll-snap 가로 스크롤 + 도트 인디케이터
 * - image_url (레거시) / image_urls (신규) 모두 지원
 */
import { useState, useRef, useCallback, useEffect } from 'react';

const LoungeImageScroll = ({ imageUrl, imageUrls, onImageClick }) => {
  // image_url + image_urls 통합 (하위 호환)
  const allImages = (() => {
    const urls = [];
    if (imageUrls && imageUrls.length > 0) {
      urls.push(...imageUrls);
    }
    if (imageUrl && !urls.includes(imageUrl)) {
      urls.unshift(imageUrl);
    }
    return urls;
  })();

  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef(null);

  // 스크롤 이벤트로 현재 인덱스 추적
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const itemWidth = el.firstChild?.offsetWidth || 1;
    const idx = Math.round(el.scrollLeft / itemWidth);
    setCurrentIndex(Math.min(idx, allImages.length - 1));
  }, [allImages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || allImages.length <= 1) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll, allImages.length]);

  if (allImages.length === 0) return null;

  // 단일 이미지 — 기존 스타일 유지
  if (allImages.length === 1) {
    return (
      <img
        src={allImages[0]}
        alt="첨부 이미지"
        className="mt-1.5 rounded-xl max-w-[240px] max-h-[240px] object-cover cursor-pointer border border-base-300"
        loading="lazy"
        onClick={() => onImageClick?.(allImages[0])}
      />
    );
  }

  // 다중 이미지 — 가로 스크롤
  return (
    <div className="mt-1.5">
      {/* 스크롤 컨테이너 */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {allImages.map((url, i) => (
          <img
            key={`${url}-${i}`}
            src={url}
            alt={`첨부 이미지 ${i + 1}`}
            className="w-[200px] h-[200px] rounded-xl object-cover cursor-pointer border border-base-300 flex-shrink-0"
            style={{ scrollSnapAlign: 'start' }}
            loading="lazy"
            onClick={() => onImageClick?.(url)}
          />
        ))}
      </div>

      {/* 도트 인디케이터 */}
      <div className="flex justify-center gap-1.5 mt-2">
        {allImages.map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
              i === currentIndex ? 'bg-orange-400' : 'bg-base-content/20'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default LoungeImageScroll;
