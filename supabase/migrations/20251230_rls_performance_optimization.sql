-- =============================================
-- RLS 성능 최적화 마이그레이션
-- 생성일: 2025-12-30
-- 설명: auth.uid() 및 auth.role() 호출을 (select auth.uid()) 형태로 감싸서
--       각 행마다 재평가되지 않고 쿼리당 한 번만 평가되도록 최적화
-- 참고: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- =============================================

-- =============================================
-- 0. 기존 정책 삭제 (재생성을 위해)
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
-- 1. users 테이블
-- =============================================
CREATE POLICY "users_select_all" ON users
  FOR SELECT USING (true);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING ((select auth.uid()) = id);

-- =============================================
-- 2. posts 테이블
-- =============================================
CREATE POLICY "posts_select_all" ON posts
  FOR SELECT USING (true);

CREATE POLICY "posts_insert_authenticated" ON posts
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "posts_update_owner" ON posts
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "posts_delete_owner" ON posts
  FOR DELETE USING ((select auth.uid()) = user_id);

-- =============================================
-- 3. comments 테이블
-- =============================================
CREATE POLICY "comments_select_all" ON comments
  FOR SELECT USING (true);

CREATE POLICY "comments_insert_authenticated" ON comments
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "comments_update_owner" ON comments
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "comments_delete_owner" ON comments
  FOR DELETE USING ((select auth.uid()) = user_id);

-- =============================================
-- 4. likes 테이블
-- =============================================
CREATE POLICY "likes_select_all" ON likes
  FOR SELECT USING (true);

CREATE POLICY "likes_insert_authenticated" ON likes
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "likes_delete_owner" ON likes
  FOR DELETE USING ((select auth.uid()) = user_id);

-- =============================================
-- 5. saved_posts 테이블
-- =============================================
CREATE POLICY "saved_posts_select_own" ON saved_posts
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "saved_posts_insert_own" ON saved_posts
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "saved_posts_delete_own" ON saved_posts
  FOR DELETE USING ((select auth.uid()) = user_id);

-- =============================================
-- 6. post_views 테이블
-- =============================================
CREATE POLICY "post_views_select_all" ON post_views
  FOR SELECT USING (true);

CREATE POLICY "post_views_insert_authenticated" ON post_views
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- =============================================
-- 7. user_post_views 테이블
-- =============================================
CREATE POLICY "user_post_views_select_authenticated" ON user_post_views
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "user_post_views_insert_authenticated" ON user_post_views
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "user_post_views_update_authenticated" ON user_post_views
  FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

-- =============================================
-- 8. admin_roles 테이블
-- =============================================
CREATE POLICY "admin_roles_admin_only" ON admin_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 9. user_badges 테이블
-- =============================================
CREATE POLICY "user_badges_select_all" ON user_badges
  FOR SELECT USING (true);

CREATE POLICY "user_badges_admin_manage" ON user_badges
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 10. user_sanctions 테이블
-- =============================================
CREATE POLICY "user_sanctions_admin_only" ON user_sanctions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 11. conversations 테이블
-- =============================================
CREATE POLICY "conversations_participant_only" ON conversations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
      AND conversation_participants.user_id = (select auth.uid())
    )
  );

-- =============================================
-- 12. conversation_participants 테이블
-- =============================================
CREATE POLICY "conversation_participants_select" ON conversation_participants
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "conversation_participants_insert" ON conversation_participants
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

-- =============================================
-- 13. messages 테이블
-- =============================================
CREATE POLICY "messages_select_participant" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.user_id = (select auth.uid())
    )
  );

CREATE POLICY "messages_insert_participant" ON messages
  FOR INSERT WITH CHECK (
    (select auth.uid()) = sender_id AND
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.user_id = (select auth.uid())
    )
  );

-- =============================================
-- 14. message_attachments 테이블
-- =============================================
CREATE POLICY "message_attachments_participant_only" ON message_attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_attachments.message_id
      AND cp.user_id = (select auth.uid())
    )
  );

-- =============================================
-- 15. message_reads 테이블
-- =============================================
CREATE POLICY "message_reads_participant_only" ON message_reads
  FOR ALL USING (user_id = (select auth.uid()));

-- =============================================
-- 16. reports 테이블
-- =============================================
CREATE POLICY "reports_insert_authenticated" ON reports
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "reports_select_admin" ON reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "reports_update_admin" ON reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 17. trade_items 테이블
-- =============================================
CREATE POLICY "trade_items_select_all" ON trade_items
  FOR SELECT USING (true);

CREATE POLICY "trade_items_insert_authenticated" ON trade_items
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "trade_items_update_authenticated" ON trade_items
  FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "trade_items_delete_authenticated" ON trade_items
  FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- =============================================
-- 18. ads 테이블
-- =============================================
CREATE POLICY "ads_select_active" ON ads
  FOR SELECT USING (is_active = true OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ads_admin_manage" ON ads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 19. ad_media 테이블
-- =============================================
CREATE POLICY "ad_media_select_all" ON ad_media
  FOR SELECT USING (true);

CREATE POLICY "ad_media_admin_manage" ON ad_media
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 20. translation_history 테이블
-- =============================================
CREATE POLICY "translation_history_select_own" ON translation_history
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "translation_history_insert_own" ON translation_history
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- =============================================
-- 21. verification_requests 테이블
-- =============================================
CREATE POLICY "verification_requests_select_own" ON verification_requests
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "verification_requests_insert_own" ON verification_requests
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "verification_requests_admin" ON verification_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 22. app_settings 테이블
-- =============================================
CREATE POLICY "app_settings_select_all" ON app_settings
  FOR SELECT USING (true);

CREATE POLICY "app_settings_admin_manage" ON app_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 23. relationships 테이블
-- =============================================
CREATE POLICY "relationships_select_all" ON relationships
  FOR SELECT USING (true);

-- =============================================
-- 24. report_categories 테이블
-- =============================================
CREATE POLICY "report_categories_select_all" ON report_categories
  FOR SELECT USING (true);

-- =============================================
-- 25. market_raw_data 테이블
-- =============================================
CREATE POLICY "market_raw_data_select_all" ON market_raw_data
  FOR SELECT USING (true);

-- =============================================
-- 26. market_data 테이블
-- =============================================
CREATE POLICY "market_data_select_all" ON market_data
  FOR SELECT USING (true);

-- =============================================
-- 27. market_summary 테이블
-- =============================================
CREATE POLICY "market_summary_select_all" ON market_summary
  FOR SELECT USING (true);

-- =============================================
-- 28. market_favorites 테이블
-- =============================================
CREATE POLICY "market_favorites_select_authenticated" ON market_favorites
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "market_favorites_insert_authenticated" ON market_favorites
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "market_favorites_delete_authenticated" ON market_favorites
  FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- =============================================
-- 29. market_alerts 테이블
-- =============================================
CREATE POLICY "market_alerts_select_authenticated" ON market_alerts
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "market_alerts_insert_authenticated" ON market_alerts
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "market_alerts_delete_authenticated" ON market_alerts
  FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- =============================================
-- 30. grade_master 테이블
-- =============================================
CREATE POLICY "grade_master_select_all" ON grade_master
  FOR SELECT USING (true);

-- =============================================
-- 31. tags 테이블
-- =============================================
CREATE POLICY "tags_select_all" ON tags
  FOR SELECT USING (true);

CREATE POLICY "tags_admin_manage" ON tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 32. tag_groups 테이블
-- =============================================
CREATE POLICY "tag_groups_select_all" ON tag_groups
  FOR SELECT USING (true);

CREATE POLICY "tag_groups_admin_manage" ON tag_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 33. tag_group_relations 테이블
-- =============================================
CREATE POLICY "tag_group_relations_select_all" ON tag_group_relations
  FOR SELECT USING (true);

-- =============================================
-- 34. post_tags 테이블
-- =============================================
CREATE POLICY "post_tags_select_all" ON post_tags
  FOR SELECT USING (true);

CREATE POLICY "post_tags_insert_post_owner" ON post_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_tags.post_id
      AND posts.user_id = (select auth.uid())
    )
  );

-- =============================================
-- 35. user_tag_permissions 테이블
-- =============================================
CREATE POLICY "user_tag_permissions_select_all" ON user_tag_permissions
  FOR SELECT USING (true);

-- =============================================
-- 36. comment_likes 테이블
-- =============================================
CREATE POLICY "comment_likes_select_all" ON comment_likes
  FOR SELECT USING (true);

CREATE POLICY "comment_likes_insert_authenticated" ON comment_likes
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "comment_likes_delete_authenticated" ON comment_likes
  FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- =============================================
-- 37. post_images 테이블
-- =============================================
CREATE POLICY "post_images_select_all" ON post_images
  FOR SELECT USING (true);

-- =============================================
-- 38. stories 테이블
-- =============================================
CREATE POLICY "stories_select_all" ON stories
  FOR SELECT USING (true);

CREATE POLICY "stories_insert_authenticated" ON stories
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "stories_update_authenticated" ON stories
  FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "stories_delete_authenticated" ON stories
  FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- =============================================
-- 39. badge_types 테이블
-- =============================================
CREATE POLICY "badge_types_select_all" ON badge_types
  FOR SELECT USING (true);

-- =============================================
-- 40. daily_report_stats 테이블
-- =============================================
CREATE POLICY "daily_report_stats_admin_only" ON daily_report_stats
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 41. cleanup_logs 테이블
-- =============================================
CREATE POLICY "cleanup_logs_admin_only" ON cleanup_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- 42. landing_page_templates 테이블
-- =============================================
CREATE POLICY "landing_page_templates_admin_only" ON landing_page_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.role IN ('admin', 'super_admin'))
  );

-- =============================================
-- 43. landing_pages 테이블
-- =============================================
CREATE POLICY "landing_pages_admin_only" ON landing_pages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.role IN ('admin', 'super_admin'))
  );

-- =============================================
-- 44. landing_page_blocks 테이블
-- =============================================
CREATE POLICY "landing_page_blocks_admin_only" ON landing_page_blocks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.role IN ('admin', 'super_admin'))
  );

-- =============================================
-- 45. landing_page_analytics 테이블
-- =============================================
CREATE POLICY "landing_page_analytics_admin_only" ON landing_page_analytics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.role IN ('admin', 'super_admin'))
  );

-- =============================================
-- 46. tags_backup_20250121 테이블
-- =============================================
CREATE POLICY "tags_backup_admin_only" ON tags_backup_20250121
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.role IN ('admin', 'super_admin'))
  );

-- =============================================
-- 47. weather_cache 테이블
-- =============================================
CREATE POLICY "weather_cache_select_all" ON weather_cache
  FOR SELECT USING (true);

CREATE POLICY "weather_cache_admin_manage" ON weather_cache
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()) AND users.role IN ('admin', 'super_admin'))
  );

-- =============================================
-- 완료 메시지
-- =============================================
-- RLS 성능 최적화 완료
-- 모든 auth.uid() 호출을 (select auth.uid())로 변경하여
-- 쿼리당 한 번만 평가되도록 최적화함
--
-- Supabase Dashboard > SQL Editor에서 실행하세요
