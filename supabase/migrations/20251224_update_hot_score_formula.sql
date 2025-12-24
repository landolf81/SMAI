-- =============================================
-- hot_score 계산 공식 수정
-- 생성일: 2025-12-24
-- 변경: 댓글 가중치 2→5, 최종 점수 ×100
-- =============================================

DROP FUNCTION IF EXISTS calculate_hot_score(INTEGER, INTEGER, INTEGER, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION calculate_hot_score(
  p_likes INTEGER,
  p_comments INTEGER,
  p_views INTEGER,
  p_created_at TIMESTAMPTZ
)
RETURNS NUMERIC AS $$
DECLARE
  age_hours NUMERIC;
  score NUMERIC;
BEGIN
  age_hours := EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 3600;
  -- 댓글 가중치: 2 → 5, 최종 결과에 100 곱함
  score := (COALESCE(p_likes, 0) * 3 + COALESCE(p_comments, 0) * 5 + COALESCE(p_views, 0) * 0.1)
           / POWER(age_hours + 2, 1.5) * 100;
  RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 모든 게시물의 hot_score 재계산
UPDATE public.posts
SET hot_score = calculate_hot_score(
  COALESCE(likes_count, 0),
  COALESCE(comments_count, 0),
  COALESCE(views_count, 0),
  created_at
)
WHERE post_type IN ('general', 'qna', 'secondhand');
