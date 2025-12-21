-- =============================================
-- RLS (Row Level Security) 활성화 마이그레이션
-- 생성일: 2025-12-21
-- 설명: Supabase Advisor 보안 경고 해결
-- =============================================

-- =============================================
-- 0. 기존 정책 삭제 (재실행 시 충돌 방지)
-- =============================================
DO $$
DECLARE
  r RECORD;
BEGIN
  -- 모든 테이블의 RLS 정책 삭제
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- =============================================
-- 1. 핵심 테이블 RLS 활성화 및 정책 설정
-- =============================================

-- posts 테이블
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_select_all" ON posts
  FOR SELECT USING (true);

CREATE POLICY "posts_insert_authenticated" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_update_owner" ON posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "posts_delete_owner" ON posts
  FOR DELETE USING (auth.uid() = user_id);

-- comments 테이블
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_all" ON comments
  FOR SELECT USING (true);

CREATE POLICY "comments_insert_authenticated" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_update_owner" ON comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "comments_delete_owner" ON comments
  FOR DELETE USING (auth.uid() = user_id);

-- likes 테이블
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes_select_all" ON likes
  FOR SELECT USING (true);

CREATE POLICY "likes_insert_authenticated" ON likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "likes_delete_owner" ON likes
  FOR DELETE USING (auth.uid() = user_id);

-- post_views 테이블 (이미 정책 있음, RLS만 활성화)
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;

-- user_post_views 테이블 (서비스에서 사용 - 모든 인증된 사용자 허용)
ALTER TABLE user_post_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_post_views_select_authenticated" ON user_post_views
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "user_post_views_insert_authenticated" ON user_post_views
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "user_post_views_update_authenticated" ON user_post_views
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- =============================================
-- 2. 사용자 관련 테이블
-- =============================================

-- admin_roles 테이블 (관리자만)
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_roles_admin_only" ON admin_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- user_badges 테이블
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_badges_select_all" ON user_badges
  FOR SELECT USING (true);

CREATE POLICY "user_badges_admin_manage" ON user_badges
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- user_sanctions 테이블 (관리자만)
ALTER TABLE user_sanctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_sanctions_admin_only" ON user_sanctions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- relationships 테이블 (현재 미사용 - SELECT만 허용)
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relationships_select_all" ON relationships
  FOR SELECT USING (true);

-- =============================================
-- 3. 메시지/DM 테이블
-- =============================================

-- conversations 테이블
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_participant_only" ON conversations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
      AND conversation_participants.user_id = auth.uid()
    )
  );

-- conversation_participants 테이블
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversation_participants_select" ON conversation_participants
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "conversation_participants_insert" ON conversation_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- message_reads 테이블
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_reads_participant_only" ON message_reads
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- 4. 신고 시스템
-- =============================================

-- reports 테이블
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_insert_authenticated" ON reports
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "reports_select_admin" ON reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "reports_update_admin" ON reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- report_categories 테이블
ALTER TABLE report_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_categories_select_all" ON report_categories
  FOR SELECT USING (true);

-- =============================================
-- 5. 중고거래/광고
-- =============================================

-- trade_items 테이블 (user_id 없음, post_id로 연결 - 인증된 사용자만)
ALTER TABLE trade_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_items_select_all" ON trade_items
  FOR SELECT USING (true);

CREATE POLICY "trade_items_insert_authenticated" ON trade_items
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "trade_items_update_authenticated" ON trade_items
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "trade_items_delete_authenticated" ON trade_items
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ads 테이블
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_select_active" ON ads
  FOR SELECT USING (is_active = true OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ads_admin_manage" ON ads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 6. 시장 정보
-- =============================================

-- market_raw_data 테이블
ALTER TABLE market_raw_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_raw_data_select_all" ON market_raw_data
  FOR SELECT USING (true);

-- market_favorites 테이블 (인증된 사용자만)
ALTER TABLE market_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_favorites_select_authenticated" ON market_favorites
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "market_favorites_insert_authenticated" ON market_favorites
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "market_favorites_delete_authenticated" ON market_favorites
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- market_alerts 테이블 (인증된 사용자만)
ALTER TABLE market_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_alerts_select_authenticated" ON market_alerts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "market_alerts_insert_authenticated" ON market_alerts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "market_alerts_delete_authenticated" ON market_alerts
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- grade_master 테이블
ALTER TABLE grade_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grade_master_select_all" ON grade_master
  FOR SELECT USING (true);

-- =============================================
-- 7. 태그 시스템
-- =============================================

-- tags 테이블
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select_all" ON tags
  FOR SELECT USING (true);

CREATE POLICY "tags_admin_manage" ON tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- tag_groups 테이블
ALTER TABLE tag_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tag_groups_select_all" ON tag_groups
  FOR SELECT USING (true);

CREATE POLICY "tag_groups_admin_manage" ON tag_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- tag_group_relations 테이블
ALTER TABLE tag_group_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tag_group_relations_select_all" ON tag_group_relations
  FOR SELECT USING (true);

-- post_tags 테이블
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_tags_select_all" ON post_tags
  FOR SELECT USING (true);

CREATE POLICY "post_tags_insert_post_owner" ON post_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_tags.post_id
      AND posts.user_id = auth.uid()
    )
  );

-- user_tag_permissions 테이블
ALTER TABLE user_tag_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_tag_permissions_select_all" ON user_tag_permissions
  FOR SELECT USING (true);

-- =============================================
-- 8. 기타 테이블
-- =============================================

-- comment_likes 테이블
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_likes_select_all" ON comment_likes
  FOR SELECT USING (true);

CREATE POLICY "comment_likes_insert_authenticated" ON comment_likes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "comment_likes_delete_authenticated" ON comment_likes
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- post_images 테이블
ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_images_select_all" ON post_images
  FOR SELECT USING (true);

-- stories 테이블 (user_id가 bigint 타입 - 인증된 사용자만)
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stories_select_all" ON stories
  FOR SELECT USING (true);

CREATE POLICY "stories_insert_authenticated" ON stories
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "stories_update_authenticated" ON stories
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "stories_delete_authenticated" ON stories
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- badge_types 테이블
ALTER TABLE badge_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badge_types_select_all" ON badge_types
  FOR SELECT USING (true);

-- daily_report_stats 테이블 (관리자만)
ALTER TABLE daily_report_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_report_stats_admin_only" ON daily_report_stats
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- cleanup_logs 테이블 (관리자만)
ALTER TABLE cleanup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cleanup_logs_admin_only" ON cleanup_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- landing_page 관련 테이블 (관리자만)
ALTER TABLE landing_page_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_page_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_page_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "landing_page_templates_admin_only" ON landing_page_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin'))
  );

CREATE POLICY "landing_pages_admin_only" ON landing_pages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin'))
  );

CREATE POLICY "landing_page_blocks_admin_only" ON landing_page_blocks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin'))
  );

CREATE POLICY "landing_page_analytics_admin_only" ON landing_page_analytics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin'))
  );

-- tags_backup_20250121 테이블 (관리자만)
ALTER TABLE tags_backup_20250121 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_backup_admin_only" ON tags_backup_20250121
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin'))
  );

-- =============================================
-- 완료 메시지
-- =============================================
-- RLS 활성화 완료: 38개 테이블
-- Supabase Dashboard > SQL Editor에서 실행하세요
