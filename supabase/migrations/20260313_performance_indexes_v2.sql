-- LCP 및 전반적 쿼리 성능 개선을 위한 인덱스 추가
-- 작성일: 2026-03-13
-- 목적: 홈 화면 market_data, aggregate 쿼리 + 자주 사용되는 테이블 인덱스 보강

-- ============================================================
-- HIGH PRIORITY: 홈 페이지 LCP 직결
-- ============================================================

-- 1. market_data 복합 인덱스
-- getMarketDataWithComparison(): eq(market_name) + eq(market_date) 쿼리 최적화
-- 현재 인덱스 없음 → 상세 가격 로딩 병목
CREATE INDEX IF NOT EXISTS idx_market_data_name_date
  ON market_data(market_name, market_date DESC);

-- 2. market_aggregate_summary 복합 인덱스
-- getSeongjuAggregateForCard(): eq(region_name) + lte(market_date) + order(DESC)
-- getSeongjuAggregateTrend(): eq(region_name) + date range + order
-- 현재 인덱스 없음 → 성주군 합계 카드 로딩 병목
CREATE INDEX IF NOT EXISTS idx_market_aggregate_region_date
  ON market_aggregate_summary(region_name, market_date DESC);

-- ============================================================
-- MEDIUM PRIORITY: 자주 사용되는 쿼리 최적화
-- ============================================================

-- 3. market_favorites 사용자별 조회
-- getFavorites(): eq(user_id) + eq(is_active) + order(created_at DESC)
CREATE INDEX IF NOT EXISTS idx_market_favorites_user_active
  ON market_favorites(user_id, is_active, created_at DESC);

-- 4. market_alerts 사용자별 조회
-- getAlerts(): eq(user_id) + eq(is_active) + order(created_at DESC)
CREATE INDEX IF NOT EXISTS idx_market_alerts_user_active
  ON market_alerts(user_id, is_active, created_at DESC);

-- 5. comment_likes 좋아요 조회/토글
-- toggleCommentLike(), getUserCommentLikes(): eq(user_id) + eq/in(comment_id)
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_comment
  ON comment_likes(user_id, comment_id);

-- 6. lounge_messages 커서 기반 페이지네이션
-- getMessages(): order(created_at DESC) + lt(created_at, cursor)
CREATE INDEX IF NOT EXISTS idx_lounge_messages_created
  ON lounge_messages(created_at DESC);

-- 7. ads 활성 광고 조회
-- getActiveAds(): eq(is_active) + date filter + order(priority DESC)
CREATE INDEX IF NOT EXISTS idx_ads_active_priority
  ON ads(is_active, priority DESC, end_date DESC)
  WHERE is_active = true;

-- ============================================================
-- LOW PRIORITY: 부수적 성능 개선
-- ============================================================

-- 8. post_views 중복 체크
-- getQuestion() 조회수 증가 시 중복 체크: eq(post_id) + eq(user_id)
CREATE INDEX IF NOT EXISTS idx_post_views_lookup
  ON post_views(post_id, user_id);

DO $$
BEGIN
  RAISE NOTICE '✅ 성능 인덱스 v2 생성 완료';
  RAISE NOTICE '  [HIGH] market_data: (market_name, market_date DESC)';
  RAISE NOTICE '  [HIGH] market_aggregate_summary: (region_name, market_date DESC)';
  RAISE NOTICE '  [MED]  market_favorites: (user_id, is_active, created_at DESC)';
  RAISE NOTICE '  [MED]  market_alerts: (user_id, is_active, created_at DESC)';
  RAISE NOTICE '  [MED]  comment_likes: (user_id, comment_id)';
  RAISE NOTICE '  [MED]  lounge_messages: (created_at DESC)';
  RAISE NOTICE '  [MED]  ads: (is_active, priority, end_date) WHERE active';
  RAISE NOTICE '  [LOW]  post_views: (post_id, user_id)';
END $$;
