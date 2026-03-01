-- 홈 화면 로딩 속도 개선을 위한 인덱스 추가
-- 작성일: 2026-03-01
-- 목적: market_summary 쿼리 + posts hot_score 조회 최적화

-- 1. market_summary 복합 인덱스
-- getMultipleMarkets(): IN(market_name) + date range 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_market_summary_name_date
  ON market_summary(market_name, market_date DESC);

-- getAvailableMarkets(): market_date = ? 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_market_summary_date
  ON market_summary(market_date DESC);

-- 2. posts hot_score 인덱스
-- getHottestPost() 폴백 쿼리: WHERE post_type='general' AND is_hidden... ORDER BY hot_score DESC
CREATE INDEX IF NOT EXISTS idx_posts_type_hotscore
  ON posts(post_type, hot_score DESC)
  WHERE is_hidden IS NULL OR is_hidden = false;

DO $$
BEGIN
  RAISE NOTICE '✅ 홈 화면 성능 인덱스 생성 완료';
  RAISE NOTICE '  - market_summary: (market_name, market_date DESC)';
  RAISE NOTICE '  - market_summary: (market_date DESC)';
  RAISE NOTICE '  - posts: (post_type, hot_score DESC) WHERE not hidden';
END $$;
