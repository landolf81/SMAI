-- =============================================================
-- 파일: 20260324_cleanup_user_notifications.sql
-- 목적: user_notifications 테이블에서 7일 이상 된 레코드 자동 삭제
--       pg_cron 확장을 사용해 매일 새벽 3시(KST, UTC+9 기준 18:00 UTC)에 실행
-- =============================================================

-- ---------------------------------------------------------------
-- 1. pg_cron 확장 활성화 (Supabase 대시보드 > Database > Extensions에서
--    pg_cron 이 이미 활성화되어 있어야 합니다)
-- ---------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ---------------------------------------------------------------
-- 2. 기존 동일 이름 job이 있으면 먼저 제거 (재실행 안전성)
-- ---------------------------------------------------------------
SELECT cron.unschedule('cleanup_user_notifications')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup_user_notifications'
);

-- ---------------------------------------------------------------
-- 3. 매일 새벽 3시 KST (= 18:00 UTC 전날) 에 7일 이상 된 알림 삭제
--    cron 표현식은 UTC 기준이므로: 새벽 3시 KST = 전날 18:00 UTC
-- ---------------------------------------------------------------
SELECT cron.schedule(
  'cleanup_user_notifications',   -- job 이름
  '0 18 * * *',                   -- 매일 18:00 UTC (= 새벽 3시 KST)
  $$
    DELETE FROM user_notifications
    WHERE created_at < NOW() - INTERVAL '7 days';
  $$
);

-- ---------------------------------------------------------------
-- 4. pg_cron 없이 수동으로 실행할 경우 아래 쿼리를 직접 실행하세요
-- ---------------------------------------------------------------
-- DELETE FROM user_notifications
-- WHERE created_at < NOW() - INTERVAL '7 days';
