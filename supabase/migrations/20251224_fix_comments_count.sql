-- 댓글 카운트 동기화 수정
-- 모든 게시물의 comments_count를 실제 댓글 수로 업데이트

-- 특정 게시물 (182번) 수정
UPDATE public.posts
SET comments_count = (
  SELECT COUNT(*)
  FROM public.comments
  WHERE comments.post_id = posts.id
)
WHERE id = 182;

-- 모든 게시물의 comments_count 동기화 (전체 수정이 필요한 경우)
-- UPDATE public.posts
-- SET comments_count = (
--   SELECT COUNT(*)
--   FROM public.comments
--   WHERE comments.post_id = posts.id
-- );
