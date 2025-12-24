-- =============================================
-- 개인화 피드 정렬 확인 쿼리
-- 사용법: p_user_id에 확인할 사용자 UUID 입력
-- =============================================

-- 방법 1: get_personalized_feed 함수 사용 (권장)
SELECT
  id,
  created_at,
  likes_count,
  comments_count,
  views_count,
  hot_score,
  view_count AS user_view_count,
  final_score,
  sort_priority,
  LEFT(description, 30) AS preview
FROM get_personalized_feed(
  '49ebd52a-225c-4ead-ab7b-38bcb4835e19'::uuid,  -- 사용자 UUID
  'general',  -- post_type: 'general', 'qna', 'secondhand'
  30,         -- limit
  0           -- offset
);

-- =============================================
-- 방법 2: 직접 쿼리 (함수 없이)
-- =============================================
/*
SELECT
  p.id,
  p.created_at,
  p.likes_count,
  p.comments_count,
  p.views_count,
  p.hot_score,
  p.is_pinned,
  COALESCE(upv.view_count, 0) AS user_view_count,
  -- final_score 계산: hot_score × (1 / (view_count + 1)^1.5)
  p.hot_score * (
    CASE
      WHEN upv.view_count IS NULL OR upv.view_count = 0 THEN 1.0
      ELSE 1.0 / POWER(COALESCE(upv.view_count, 0) + 1, 1.5)
    END
  ) AS final_score,
  LEFT(p.description, 30) AS preview
FROM public.posts p
LEFT JOIN public.user_post_views upv
  ON upv.post_id = p.id
  AND upv.user_id = '49ebd52a-225c-4ead-ab7b-38bcb4835e19'
WHERE p.post_type IN ('general', 'qna', 'secondhand')
  AND (p.is_hidden IS NULL OR p.is_hidden = false)
ORDER BY p.is_pinned DESC,
  p.hot_score * (
    CASE
      WHEN upv.view_count IS NULL OR upv.view_count = 0 THEN 1.0
      ELSE 1.0 / POWER(COALESCE(upv.view_count, 0) + 1, 1.5)
    END
  ) DESC
LIMIT 30;
*/

-- =============================================
-- 정렬 로직 설명
-- =============================================
-- sort_priority:
--   1 = 고정 게시물 (is_pinned = true)
--   2 = 6시간 이내 최신글 상위 3개
--   3 = 나머지
--
-- final_score = hot_score × 열람 가중치
-- 열람 가중치 = 1 / (view_count + 1)^1.5
--   0회: ×1.0
--   1회: ×0.35
--   2회: ×0.19
--   3회: ×0.125
--   5회: ×0.068
--   10회: ×0.028
