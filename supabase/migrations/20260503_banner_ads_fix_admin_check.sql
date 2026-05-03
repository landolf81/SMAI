-- =====================================================================
-- banner_ads RLS 정책 수정
-- 작성일: 2026-05-03
-- 사유:
--   1) 이 프로젝트의 users 테이블에는 role 컬럼이 없다 (admin_roles 테이블만 존재)
--   2) admin_roles.role 값은 'admin', 'super_admin', 'content_admin' 등 다양함
--      → 기존 정책이 ('super_admin','content_admin')만 허용하면 'admin' 역할 사용자가 거부됨
-- 패턴: 20260324_badge_types_admin_rls.sql, 20260103_fix_youtube_rls.sql 와 동일하게 정렬
-- =====================================================================

-- banner_ads
DROP POLICY IF EXISTS "banner_ads_select_active_or_admin" ON banner_ads;
CREATE POLICY "banner_ads_select_active_or_admin" ON banner_ads
  FOR SELECT
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.role IN ('admin', 'super_admin', 'content_admin')
    )
  );

DROP POLICY IF EXISTS "banner_ads_admin_insert" ON banner_ads;
CREATE POLICY "banner_ads_admin_insert" ON banner_ads
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.role IN ('admin', 'super_admin', 'content_admin')
    )
  );

DROP POLICY IF EXISTS "banner_ads_admin_update" ON banner_ads;
CREATE POLICY "banner_ads_admin_update" ON banner_ads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.role IN ('admin', 'super_admin', 'content_admin')
    )
  );

DROP POLICY IF EXISTS "banner_ads_admin_delete" ON banner_ads;
CREATE POLICY "banner_ads_admin_delete" ON banner_ads
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.role IN ('admin', 'super_admin', 'content_admin')
    )
  );

-- banner_ad_views
DROP POLICY IF EXISTS "banner_ad_views_admin_select" ON banner_ad_views;
CREATE POLICY "banner_ad_views_admin_select" ON banner_ad_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.role IN ('admin', 'super_admin', 'content_admin')
    )
  );

-- banner_ad_clicks
DROP POLICY IF EXISTS "banner_ad_clicks_admin_select" ON banner_ad_clicks;
CREATE POLICY "banner_ad_clicks_admin_select" ON banner_ad_clicks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.role IN ('admin', 'super_admin', 'content_admin')
    )
  );
