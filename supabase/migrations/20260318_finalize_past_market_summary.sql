-- 과거 날짜의 market_summary를 자동으로 is_finalized = true로 설정하는 크론 작업
-- 매일 KST 05:00 (UTC 20:00)에 실행
-- 목적: 외부 입력으로 들어온 데이터가 다음 날이 되면 자동 확정 처리
-- 작성일: 2026-03-18

SELECT cron.schedule(
  'finalize-past-market-summary',
  '0 20 * * *',  -- UTC 20:00 = KST 05:00
  $$
    UPDATE market_summary
    SET is_finalized = true
    WHERE market_date < (now() AT TIME ZONE 'Asia/Seoul')::date
      AND is_finalized = false;
  $$
);

DO $$
BEGIN
  RAISE NOTICE '✅ finalize-past-market-summary 크론 작업 생성 완료';
  RAISE NOTICE '  스케줄: 매일 KST 05:00 (UTC 20:00)';
  RAISE NOTICE '  동작: 과거 날짜의 market_summary.is_finalized → true';
END $$;
