-- check-price-push cron 시간 변경
-- 변경: KST 12:22 → KST 11:52
-- pg_cron은 UTC 기준이므로: UTC 03:22 → UTC 02:52

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- check-price-push 함수를 호출하는 기존 스케줄 모두 삭제
-- (이름이 다를 수 있으므로 command 매칭으로 안전하게 정리)
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN
    SELECT jobname FROM cron.job WHERE command ILIKE '%check-price-push%'
  LOOP
    PERFORM cron.unschedule(job_record.jobname);
    RAISE NOTICE 'Unscheduled: %', job_record.jobname;
  END LOOP;
END $$;

-- 새 스케줄 등록: KST 11:52 (UTC 02:52)
SELECT cron.schedule(
  'check-price-push',
  '52 2 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://zynlhezlaxvolpptruiu.supabase.co/functions/v1/check-price-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- 등록 확인
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'check-price-push';
