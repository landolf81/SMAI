-- push_logs 30일 이상 지난 알림 자동 삭제
-- 매일 KST 04:00 (UTC 19:00) 실행
-- 작성일: 2026-03-17

SELECT cron.schedule(
  'cleanup-old-push-logs',
  '0 19 * * *',
  $$DELETE FROM push_logs WHERE created_at < now() - interval '30 days'$$
);
