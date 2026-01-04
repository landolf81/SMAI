-- 게시글 삭제 시 관련 데이터 자동 삭제 (CASCADE) 설정
-- 2025-01-04

-- ============================================
-- 0. 먼저 고아 데이터 정리 (존재하지 않는 post_id 참조)
-- ============================================

-- likes 테이블에서 존재하지 않는 post_id 삭제
DELETE FROM public.likes
WHERE post_id NOT IN (SELECT id FROM public.posts);

-- comments 테이블에서 존재하지 않는 post_id 삭제
DELETE FROM public.comments
WHERE post_id NOT IN (SELECT id FROM public.posts);

-- post_views 테이블에서 존재하지 않는 post_id 삭제
DELETE FROM public.post_views
WHERE post_id NOT IN (SELECT id FROM public.posts);

-- user_post_views 테이블에서 존재하지 않는 post_id 삭제
DELETE FROM public.user_post_views
WHERE post_id NOT IN (SELECT id FROM public.posts);

-- post_tags 테이블에서 존재하지 않는 post_id 삭제
DELETE FROM public.post_tags
WHERE post_id NOT IN (SELECT id FROM public.posts);

-- reports 테이블에서 존재하지 않는 post_id 삭제 (post_id가 있는 경우만)
DELETE FROM public.reports
WHERE post_id IS NOT NULL AND post_id NOT IN (SELECT id FROM public.posts);

-- saved_posts 테이블에서 존재하지 않는 post_id 삭제 (테이블이 있는 경우)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_posts' AND table_schema = 'public') THEN
    EXECUTE 'DELETE FROM public.saved_posts WHERE post_id NOT IN (SELECT id FROM public.posts)';
  END IF;
END $$;

-- trade_items 테이블에서 존재하지 않는 post_id 삭제 (테이블이 있는 경우)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trade_items' AND table_schema = 'public') THEN
    EXECUTE 'DELETE FROM public.trade_items WHERE post_id NOT IN (SELECT id FROM public.posts)';
  END IF;
END $$;

-- comment_likes 테이블에서 존재하지 않는 comment_id 삭제 (테이블이 있는 경우)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comment_likes' AND table_schema = 'public') THEN
    EXECUTE 'DELETE FROM public.comment_likes WHERE comment_id NOT IN (SELECT id FROM public.comments)';
  END IF;
END $$;

-- ============================================
-- 1. 외래 키 CASCADE 설정
-- ============================================

-- 1. likes 테이블 - post_id 외래 키에 CASCADE 추가
ALTER TABLE public.likes
  DROP CONSTRAINT IF EXISTS likes_post_id_fkey;

ALTER TABLE public.likes
  ADD CONSTRAINT likes_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

-- 2. comments 테이블 - post_id 외래 키에 CASCADE 추가
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_post_id_fkey;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

-- 3. post_views 테이블 - post_id 외래 키에 CASCADE 추가
ALTER TABLE public.post_views
  DROP CONSTRAINT IF EXISTS post_views_post_id_fkey;

ALTER TABLE public.post_views
  ADD CONSTRAINT post_views_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

-- 4. user_post_views 테이블 - post_id 외래 키에 CASCADE 추가
ALTER TABLE public.user_post_views
  DROP CONSTRAINT IF EXISTS user_post_views_post_id_fkey;

ALTER TABLE public.user_post_views
  ADD CONSTRAINT user_post_views_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

-- 5. post_tags 테이블 - post_id 외래 키에 CASCADE 추가
ALTER TABLE public.post_tags
  DROP CONSTRAINT IF EXISTS post_tags_post_id_fkey;

ALTER TABLE public.post_tags
  ADD CONSTRAINT post_tags_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

-- 6. reports 테이블 - post_id 외래 키에 CASCADE 추가 (nullable이므로 SET NULL도 고려 가능)
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_post_id_fkey;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

-- 7. saved_posts 테이블 (있다면) - post_id 외래 키에 CASCADE 추가
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_posts') THEN
    ALTER TABLE public.saved_posts
      DROP CONSTRAINT IF EXISTS saved_posts_post_id_fkey;

    ALTER TABLE public.saved_posts
      ADD CONSTRAINT saved_posts_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 8. trade_items 테이블 (있다면) - post_id 외래 키에 CASCADE 추가
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trade_items') THEN
    ALTER TABLE public.trade_items
      DROP CONSTRAINT IF EXISTS trade_items_post_id_fkey;

    ALTER TABLE public.trade_items
      ADD CONSTRAINT trade_items_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 9. comment_likes 테이블 - comment_id 외래 키에 CASCADE 추가 (댓글 삭제 시)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comment_likes') THEN
    ALTER TABLE public.comment_likes
      DROP CONSTRAINT IF EXISTS comment_likes_comment_id_fkey;

    ALTER TABLE public.comment_likes
      ADD CONSTRAINT comment_likes_comment_id_fkey
      FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ CASCADE DELETE 설정 완료';
  RAISE NOTICE '  - likes: post_id → posts(id) ON DELETE CASCADE';
  RAISE NOTICE '  - comments: post_id → posts(id) ON DELETE CASCADE';
  RAISE NOTICE '  - post_views: post_id → posts(id) ON DELETE CASCADE';
  RAISE NOTICE '  - user_post_views: post_id → posts(id) ON DELETE CASCADE';
  RAISE NOTICE '  - post_tags: post_id → posts(id) ON DELETE CASCADE';
  RAISE NOTICE '  - reports: post_id → posts(id) ON DELETE CASCADE';
  RAISE NOTICE '  - saved_posts: post_id → posts(id) ON DELETE CASCADE (if exists)';
  RAISE NOTICE '  - trade_items: post_id → posts(id) ON DELETE CASCADE (if exists)';
  RAISE NOTICE '  - comment_likes: comment_id → comments(id) ON DELETE CASCADE (if exists)';
END $$;
