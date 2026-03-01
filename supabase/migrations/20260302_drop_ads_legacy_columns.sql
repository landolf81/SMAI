-- ads 테이블 레거시 컬럼 제거
-- 작성일: 2026-03-02
-- 배경: click_count, view_count는 실제로 업데이트되지 않는 미사용 컬럼.
--       실제 추적은 clicks(RPC increment_ad_clicks), impressions(RPC increment_ad_impressions)으로 이루어짐.

ALTER TABLE ads DROP COLUMN IF EXISTS click_count;
ALTER TABLE ads DROP COLUMN IF EXISTS view_count;

DO $$
BEGIN
  RAISE NOTICE '✅ ads 레거시 컬럼 제거 완료: click_count, view_count';
  RAISE NOTICE '  실제 통계는 clicks, impressions 컬럼 사용';
END $$;
