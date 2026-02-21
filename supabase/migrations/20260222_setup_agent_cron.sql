-- OpenClaw 에이전트 요청 스케줄 설정
-- 8시 / 14시 / 20시 / 02시 (KST) → UTC 변환: 23시 / 05시 / 11시 / 17시

-- pg_net 활성화 (HTTP 호출용, 이미 활성화 시 무시)
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 기존 스케줄 삭제 (재실행 시 중복 방지)
SELECT cron.unschedule('request-agent-briefing') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'request-agent-briefing'
);

-- 8시/14시/20시/02시 KST = 23시/05시/11시/17시 UTC
SELECT cron.schedule(
  'request-agent-briefing',
  '0 23,5,11,17 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://zynlhezlaxvolpptruiu.supabase.co/functions/v1/request-agent',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- 등록 확인
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'request-agent-briefing';
