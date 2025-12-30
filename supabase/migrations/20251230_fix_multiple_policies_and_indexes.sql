-- =============================================
-- RLS Multiple Permissive Policies 및 중복 인덱스 수정
-- 생성일: 2025-12-30
-- 설명:
--   1. FOR ALL 정책이 SELECT와 중복되는 문제 해결 (INSERT/UPDATE/DELETE로 분리)
--   2. 중복 인덱스 삭제
-- 참고: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies
-- =============================================

-- =============================================
-- PART 1: 중복 인덱스 삭제
-- =============================================

-- messages 테이블: idx_messages_sender와 idx_messages_sender_id 중 하나 삭제
DROP INDEX IF EXISTS idx_messages_sender;

-- posts 테이블: idx_posts_user와 idx_posts_user_created 중 하나 삭제
DROP INDEX IF EXISTS idx_posts_user;

-- user_post_views 테이블: idx_user_post_views_user_post와 idx_views_user_post 중 하나 삭제
DROP INDEX IF EXISTS idx_views_user_post;

-- =============================================
-- PART 2: Multiple Permissive Policies 수정
-- FOR ALL을 사용하는 정책을 개별 작업으로 분리
-- (SELECT는 이미 별도 정책이 있으므로 INSERT/UPDATE/DELETE만 생성)
-- =============================================

-- 영향받는 테이블:
-- 1. ad_media: ad_media_select_all (SELECT) + ad_media_admin_manage (ALL)
-- 2. ads: ads_select_active (SELECT) + ads_admin_manage (ALL)
-- 3. app_settings: app_settings_select_all (SELECT) + app_settings_admin_manage (ALL)
-- 4. tag_groups: tag_groups_select_all (SELECT) + tag_groups_admin_manage (ALL)
-- 5. tags: tags_select_all (SELECT) + tags_admin_manage (ALL)
-- 6. user_badges: user_badges_select_all (SELECT) + user_badges_admin_manage (ALL)
-- 7. verification_requests: verification_requests_select_own (SELECT) + verification_requests_admin (ALL)
-- 8. weather_cache: weather_cache_select_all (SELECT) + weather_cache_admin_manage (ALL)

-- =============================================
-- 9. user_badges 테이블 수정
-- =============================================
DROP POLICY IF EXISTS "user_badges_admin_manage" ON user_badges;

CREATE POLICY "user_badges_admin_insert" ON user_badges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "user_badges_admin_update" ON user_badges
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "user_badges_admin_delete" ON user_badges
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 18. ads 테이블 수정
-- =============================================
DROP POLICY IF EXISTS "ads_admin_manage" ON ads;

CREATE POLICY "ads_admin_insert" ON ads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ads_admin_update" ON ads
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ads_admin_delete" ON ads
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 19. ad_media 테이블 수정
-- =============================================
DROP POLICY IF EXISTS "ad_media_admin_manage" ON ad_media;

CREATE POLICY "ad_media_admin_insert" ON ad_media
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ad_media_admin_update" ON ad_media
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ad_media_admin_delete" ON ad_media
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 21. verification_requests 테이블 수정
-- =============================================
DROP POLICY IF EXISTS "verification_requests_admin" ON verification_requests;

CREATE POLICY "verification_requests_admin_update" ON verification_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "verification_requests_admin_delete" ON verification_requests
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 22. app_settings 테이블 수정
-- =============================================
DROP POLICY IF EXISTS "app_settings_admin_manage" ON app_settings;

CREATE POLICY "app_settings_admin_insert" ON app_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "app_settings_admin_update" ON app_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "app_settings_admin_delete" ON app_settings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 31. tags 테이블 수정
-- =============================================
DROP POLICY IF EXISTS "tags_admin_manage" ON tags;

CREATE POLICY "tags_admin_insert" ON tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "tags_admin_update" ON tags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "tags_admin_delete" ON tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 32. tag_groups 테이블 수정
-- =============================================
DROP POLICY IF EXISTS "tag_groups_admin_manage" ON tag_groups;

CREATE POLICY "tag_groups_admin_insert" ON tag_groups
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "tag_groups_admin_update" ON tag_groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "tag_groups_admin_delete" ON tag_groups
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 47. weather_cache 테이블 수정
-- =============================================
DROP POLICY IF EXISTS "weather_cache_admin_manage" ON weather_cache;

CREATE POLICY "weather_cache_admin_insert" ON weather_cache
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.role IN ('admin', 'super_admin'))
  );

CREATE POLICY "weather_cache_admin_update" ON weather_cache
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.role IN ('admin', 'super_admin'))
  );

CREATE POLICY "weather_cache_admin_delete" ON weather_cache
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.role IN ('admin', 'super_admin'))
  );

-- =============================================
-- 완료 메시지
-- =============================================
-- 수정 완료:
-- 1. 중복 인덱스 3개 삭제
-- 2. 8개 테이블의 FOR ALL 정책을 개별 INSERT/UPDATE/DELETE 정책으로 분리
--
-- Supabase Dashboard > SQL Editor에서 실행하세요
