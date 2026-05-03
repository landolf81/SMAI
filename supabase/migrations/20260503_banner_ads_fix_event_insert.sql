-- =====================================================================
-- banner_ad_views / banner_ad_clicks INSERT 정책 단순화
-- 작성일: 2026-05-03
-- 사유:
--   기존 INSERT 정책이 EXISTS (SELECT 1 FROM banner_ads ...) 서브쿼리를 사용했는데,
--   이 서브쿼리는 RLS 체이닝으로 banner_ads → admin_roles 까지 evaluate하면서
--   admin_roles의 깨진 정책(users.role 참조) 때문에 ERROR가 발생해 INSERT 403.
--
--   광고 노출/클릭 기록은 보안 민감 데이터가 아니므로 INSERT를 누구나 허용해도 안전.
--   FK 제약(REFERENCES banner_ads(id))이 banner_ad_id 무결성을 보장하므로
--   존재하지 않는 광고에 대한 기록은 차단됨. 비활성 광고에 대한 기록은 허용되지만
--   리포트 집계는 banner_ads.is_active로 필터링하면 충분.
-- =====================================================================

DROP POLICY IF EXISTS "banner_ad_views_insert_any" ON banner_ad_views;
CREATE POLICY "banner_ad_views_insert_any" ON banner_ad_views
  FOR INSERT
  WITH CHECK (banner_ad_id IS NOT NULL);

DROP POLICY IF EXISTS "banner_ad_clicks_insert_any" ON banner_ad_clicks;
CREATE POLICY "banner_ad_clicks_insert_any" ON banner_ad_clicks
  FOR INSERT
  WITH CHECK (banner_ad_id IS NOT NULL);
