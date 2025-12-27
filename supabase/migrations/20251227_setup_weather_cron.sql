-- pg_cron으로 날씨 캐시 자동 갱신 설정
-- Supabase Pro 플랜 필요

-- pg_cron 확장 활성화 (이미 활성화되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- pg_net 확장 활성화 (HTTP 호출용)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 기존 스케줄 삭제 (재실행 시 중복 방지)
SELECT cron.unschedule('update-weather-cache');

-- 매시간 10분에 Edge Function 호출 (초단기실황: 정각 발표, 10분 후 API 제공)
-- 참고: project_ref를 실제 Supabase 프로젝트 ID로 변경 필요
SELECT cron.schedule(
  'update-weather-cache',
  '10 * * * *',  -- 매시간 10분
  $$
  SELECT net.http_post(
    url := 'https://zynlhezlaxvolpptruiu.supabase.co/functions/v1/update-weather',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 스케줄 확인
SELECT * FROM cron.job;
