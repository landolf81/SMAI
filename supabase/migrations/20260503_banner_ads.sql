-- =====================================================================
-- 배너 광고 시스템 (slot 기반)
-- 작성일: 2026-05-03
-- - banner_ads: 배너 광고 마스터
-- - banner_ad_views: 노출 기록
-- - banner_ad_clicks: 클릭 기록
-- - RPC: increment_banner_ad_impressions / increment_banner_ad_clicks
-- - RLS: 활성 광고는 누구나 SELECT, 관리자(admin_roles)만 INSERT/UPDATE/DELETE
-- =====================================================================

-- 1) banner_ads
CREATE TABLE IF NOT EXISTS banner_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  advertiser_name TEXT,
  slot TEXT NOT NULL CHECK (slot IN (
    'home_top','prices_top','prices_middle','market_trend_top','lounge_top','community_top'
  )),
  image_url TEXT NOT NULL,
  alt_text TEXT,
  landing_slug TEXT UNIQUE,
  external_url TEXT,
  cta_text TEXT,
  title TEXT,
  body TEXT,
  contact_phone TEXT,
  start_date DATE,
  end_date DATE,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  memo TEXT,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE banner_ads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_banner_ads_slot_active
  ON banner_ads(slot, is_active, priority DESC);

CREATE INDEX IF NOT EXISTS idx_banner_ads_landing_slug
  ON banner_ads(landing_slug)
  WHERE landing_slug IS NOT NULL;

-- 2) banner_ad_views
CREATE TABLE IF NOT EXISTS banner_ad_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_ad_id UUID NOT NULL REFERENCES banner_ads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  user_agent TEXT,
  source TEXT
);

ALTER TABLE banner_ad_views ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_banner_ad_views_ad_date
  ON banner_ad_views(banner_ad_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_banner_ad_views_session
  ON banner_ad_views(banner_ad_id, session_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_banner_ad_views_user
  ON banner_ad_views(banner_ad_id, user_id, viewed_at DESC);

-- 3) banner_ad_clicks
CREATE TABLE IF NOT EXISTS banner_ad_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_ad_id UUID NOT NULL REFERENCES banner_ads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  clicked_at TIMESTAMPTZ DEFAULT now(),
  user_agent TEXT
);

ALTER TABLE banner_ad_clicks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_banner_ad_clicks_ad_date
  ON banner_ad_clicks(banner_ad_id, clicked_at DESC);

-- 4) 카운터 증가 RPC (LANGUAGE SQL, dollar-quote 미사용)
CREATE OR REPLACE FUNCTION increment_banner_ad_impressions(ad_id_param UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
AS 'UPDATE banner_ads SET impressions = COALESCE(impressions, 0) + 1 WHERE id = ad_id_param AND is_active = true';

CREATE OR REPLACE FUNCTION increment_banner_ad_clicks(ad_id_param UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
AS 'UPDATE banner_ads SET clicks = COALESCE(clicks, 0) + 1 WHERE id = ad_id_param';

GRANT EXECUTE ON FUNCTION increment_banner_ad_impressions(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_banner_ad_clicks(UUID) TO anon, authenticated;

-- 5) RLS 정책 — banner_ads
-- 이 프로젝트의 어드민 권한은 admin_roles 테이블로만 관리됨 (users.role 컬럼 없음)
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

-- 6) RLS 정책 — banner_ad_views (인서트는 누구나, 조회는 관리자만)
-- INSERT는 단순화 — FK 제약이 무결성을 보장하므로 추가 검증 불필요
DROP POLICY IF EXISTS "banner_ad_views_insert_any" ON banner_ad_views;
CREATE POLICY "banner_ad_views_insert_any" ON banner_ad_views
  FOR INSERT
  WITH CHECK (banner_ad_id IS NOT NULL);

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

-- 7) RLS 정책 — banner_ad_clicks
DROP POLICY IF EXISTS "banner_ad_clicks_insert_any" ON banner_ad_clicks;
CREATE POLICY "banner_ad_clicks_insert_any" ON banner_ad_clicks
  FOR INSERT
  WITH CHECK (banner_ad_id IS NOT NULL);

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

-- 8) 권한
GRANT SELECT ON banner_ads TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON banner_ads TO authenticated;
GRANT INSERT ON banner_ad_views TO anon, authenticated;
GRANT INSERT ON banner_ad_clicks TO anon, authenticated;
GRANT SELECT ON banner_ad_views TO authenticated;
GRANT SELECT ON banner_ad_clicks TO authenticated;
