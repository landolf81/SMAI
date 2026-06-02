-- 3일 이상 된 pending/rejected YouTube 영상 자동 정리 함수
-- 승인된(approved) 영상은 보존
-- collect-youtube-videos 엣지 함수가 호출 시점마다 같은 정리를 수행하므로
-- 별도 cron 없이도 동작하지만, pg_cron 등으로 보조 스케줄링이 필요한 경우 사용 가능
--
-- 사용 예 (pg_cron):
--   SELECT cron.schedule('cleanup-youtube-videos', '0 3 * * *', $$SELECT cleanup_old_youtube_videos()$$);

CREATE OR REPLACE FUNCTION cleanup_old_youtube_videos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM youtube_videos
    WHERE status IN ('pending', 'rejected')
      AND collected_at < NOW() - INTERVAL '3 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

-- collected_at 인덱스 (정리 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_youtube_videos_status_collected
  ON youtube_videos(status, collected_at)
  WHERE status IN ('pending', 'rejected');

COMMENT ON FUNCTION cleanup_old_youtube_videos IS
  '3일 이상 된 pending/rejected YouTube 영상 삭제. 승인된 영상은 보존. 삭제 개수 반환.';
