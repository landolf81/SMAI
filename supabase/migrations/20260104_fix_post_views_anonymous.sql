-- post_views 테이블 익명 사용자 INSERT 허용
-- 2026-01-04

-- 기존 정책 삭제 후 재생성
DROP POLICY IF EXISTS "post_views_insert_authenticated" ON post_views;
DROP POLICY IF EXISTS "Anyone can insert post_views" ON post_views;
DROP POLICY IF EXISTS "post_views_select_all" ON post_views;

-- 모든 사용자 SELECT 허용
CREATE POLICY "post_views_select_all" ON post_views
  FOR SELECT USING (true);

-- 모든 사용자 INSERT 허용 (익명 포함)
CREATE POLICY "post_views_insert_anyone" ON post_views
  FOR INSERT WITH CHECK (true);
