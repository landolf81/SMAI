-- 성능 최적화를 위한 데이터베이스 인덱스 추가
-- 작성일: 2025-12-18
-- 목적: 피드 로딩 및 쿼리 성능 개선

-- 1. 게시물 조회 최적화
-- user_id와 created_at을 함께 조회하는 경우 최적화
CREATE INDEX IF NOT EXISTS idx_posts_user_created
  ON posts(user_id, created_at DESC);

-- post_type, is_hidden, created_at을 함께 조회하는 경우 최적화 (관리자 페이지)
CREATE INDEX IF NOT EXISTS idx_posts_type_hidden_created
  ON posts(post_type, is_hidden, created_at DESC);

-- 2. 댓글 조회 최적화
-- post_id로 댓글 조회 시 is_hidden 필터링 및 정렬 최적화
CREATE INDEX IF NOT EXISTS idx_comments_post_hidden_created
  ON comments(post_id, is_hidden, created_at DESC);

-- 3. 좋아요 조회 최적화
-- post_id로 좋아요 수 집계 시 최적화
CREATE INDEX IF NOT EXISTS idx_likes_post_id
  ON likes(post_id);

-- user_id로 사용자의 좋아요 조회 시 최적화
CREATE INDEX IF NOT EXISTS idx_likes_user_id
  ON likes(user_id);

-- 4. 태그 관계 조회 최적화
-- post_id로 게시물의 태그 조회 시 최적화
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id
  ON post_tags(post_id);

-- tag_id로 특정 태그의 게시물 조회 시 최적화
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id
  ON post_tags(tag_id);

-- 5. 열람 이력 최적화
-- user_id와 post_id 조합으로 중복 체크 시 최적화
CREATE INDEX IF NOT EXISTS idx_views_user_post
  ON user_post_views(user_id, post_id);

-- 6. 신고 조회 최적화
-- post_id로 신고 조회 시 최적화
CREATE INDEX IF NOT EXISTS idx_reports_post_id
  ON reports(post_id)
  WHERE post_id IS NOT NULL;

-- comment_id로 신고 조회 시 최적화
CREATE INDEX IF NOT EXISTS idx_reports_comment_id
  ON reports(comment_id)
  WHERE comment_id IS NOT NULL;

-- 신고 상태별 조회 최적화 (관리자 페이지)
CREATE INDEX IF NOT EXISTS idx_reports_status_created
  ON reports(status, created_at DESC);

-- 인덱스 생성 완료 확인
DO $$
BEGIN
  RAISE NOTICE '✅ 성능 최적화 인덱스 생성 완료';
  RAISE NOTICE '📊 생성된 인덱스:';
  RAISE NOTICE '  - posts: user_id+created_at, type+hidden+created_at';
  RAISE NOTICE '  - comments: post_id+hidden+created_at';
  RAISE NOTICE '  - likes: post_id, user_id';
  RAISE NOTICE '  - post_tags: post_id, tag_id';
  RAISE NOTICE '  - user_post_views: user_id+post_id';
  RAISE NOTICE '  - reports: post_id, comment_id, status+created_at';
  RAISE NOTICE '';
  RAISE NOTICE '참고: secondhand, qna는 별도 테이블이 아닌 posts.post_type으로 구분됩니다.';
  RAISE NOTICE '자세한 내용은 supabase/DATABASE_SCHEMA.md를 참조하세요.';
END $$;
