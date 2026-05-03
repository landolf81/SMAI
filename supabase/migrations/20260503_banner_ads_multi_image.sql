-- =====================================================================
-- banner_ads 다중 이미지 지원
-- 작성일: 2026-05-03
-- - image_urls TEXT[] 컬럼 추가 (image_url 외 추가 이미지들)
-- - image_url은 primary 이미지로 유지 (하위 호환)
-- - 클라이언트는 [image_url, ...image_urls]를 통합해 사용
-- =====================================================================

ALTER TABLE banner_ads
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
