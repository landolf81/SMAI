/**
 * LazyStreamPlayer.jsx
 * CloudflareStreamPlayer를 lazy load하는 래퍼 컴포넌트
 * hls.js (527KB)가 초기 번들에 포함되지 않도록 지연 로딩
 */
import { lazy, Suspense } from 'react';

const CloudflareStreamPlayer = lazy(() => import('./CloudflareStreamPlayer'));

const LazyStreamPlayer = (props) => (
  <Suspense
    fallback={
      <div
        className="bg-base-300 animate-pulse rounded-lg"
        style={{ aspectRatio: props.aspectRatio || '16/9' }}
      />
    }
  >
    <CloudflareStreamPlayer {...props} />
  </Suspense>
);

export default LazyStreamPlayer;
