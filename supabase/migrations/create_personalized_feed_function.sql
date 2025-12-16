-- 개인화 피드 함수: 열람 횟수 + 고정 + 최신글 로직을 DB에서 처리
-- 프론트엔드 로직을 DB로 이관하여 정확한 정렬 및 성능 개선

CREATE OR REPLACE FUNCTION get_personalized_feed(
  p_user_id UUID DEFAULT NULL,
  p_post_type TEXT DEFAULT 'general',
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  user_id UUID,
  description TEXT,
  photo TEXT[],
  video TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_pinned BOOLEAN,
  post_type TEXT,
  likes_count INTEGER,
  comments_count INTEGER,
  views_count INTEGER,
  hot_score REAL,
  view_count INTEGER,
  final_score REAL,
  sort_priority INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  six_hours_ago TIMESTAMPTZ := NOW() - INTERVAL '6 hours';
BEGIN
  RETURN QUERY
  WITH ranked_posts AS (
    SELECT
      p.id,
      p.user_id,
      p.description,
      p.photo,
      p.video,
      p.created_at,
      p.updated_at,
      p.is_pinned,
      p.post_type,
      p.likes_count,
      p.comments_count,
      p.views_count,
      p.hot_score,
      COALESCE(upv.view_count, 0) AS view_count,
      -- 열람 횟수별 가중치: 0회=×5.0, 1회=×0.5, 2회=×0.25, ...
      p.hot_score * (
        CASE
          WHEN upv.view_count IS NULL OR upv.view_count = 0 THEN 5.0
          ELSE GREATEST(0.01, 0.5 / upv.view_count)
        END
      ) AS final_score,
      -- 정렬 우선순위: 1=고정, 2=6시간이내 최신(상위3개), 3=나머지
      CASE
        WHEN p.is_pinned = TRUE THEN 1
        WHEN p.created_at >= six_hours_ago THEN 2
        ELSE 3
      END AS sort_priority,
      -- 6시간 이내 최신글 중 순위 (상위 3개만 priority 2 유지)
      CASE
        WHEN p.created_at >= six_hours_ago THEN
          ROW_NUMBER() OVER (
            PARTITION BY (p.created_at >= six_hours_ago)
            ORDER BY p.created_at DESC
          )
        ELSE NULL
      END AS recent_rank
    FROM posts p
    LEFT JOIN user_post_views upv
      ON p.id = upv.post_id
      AND upv.user_id = p_user_id
    WHERE
      (p_post_type IS NULL OR p.post_type = p_post_type)
  ),
  final_ranked AS (
    SELECT
      rp.*,
      -- 6시간 이내 최신글 중 4번째 이후는 priority 3으로 변경
      CASE
        WHEN rp.sort_priority = 2 AND rp.recent_rank > 3 THEN 3
        ELSE rp.sort_priority
      END AS adjusted_priority
    FROM ranked_posts rp
  )
  SELECT
    fr.id,
    fr.user_id,
    fr.description,
    fr.photo,
    fr.video,
    fr.created_at,
    fr.updated_at,
    fr.is_pinned,
    fr.post_type,
    fr.likes_count,
    fr.comments_count,
    fr.views_count,
    fr.hot_score,
    fr.view_count::INTEGER,
    fr.final_score,
    fr.adjusted_priority AS sort_priority
  FROM final_ranked fr
  ORDER BY
    fr.adjusted_priority ASC,  -- 1=고정, 2=최신3개, 3=나머지
    CASE
      WHEN fr.adjusted_priority = 2 THEN fr.created_at  -- 최신글은 최신순
      ELSE NULL
    END DESC NULLS LAST,
    CASE
      WHEN fr.adjusted_priority IN (1, 3) THEN fr.final_score  -- 고정/나머지는 점수순
      ELSE NULL
    END DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 함수 권한 설정
GRANT EXECUTE ON FUNCTION get_personalized_feed TO authenticated;
GRANT EXECUTE ON FUNCTION get_personalized_feed TO anon;

COMMENT ON FUNCTION get_personalized_feed IS '개인화 피드 조회 - 열람횟수/고정/최신글 가중치 적용';
