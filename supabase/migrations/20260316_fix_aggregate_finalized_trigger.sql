-- 트리거 수정: 성주군 5개 공판장만 체크하도록 변경
-- 기존: 모든 market_summary의 is_finalized를 bool_and → 가락/대전 포함되어 항상 false
-- 수정: 성주군 5개 공판장(선남농협, 성주원예, 성주조공, 용암농협, 초전농협)만 체크
-- 작성일: 2026-03-16

CREATE OR REPLACE FUNCTION update_aggregate_summary_finalized()
RETURNS trigger AS $$
DECLARE
  all_finalized boolean;
BEGIN
  -- 해당 날짜의 성주군 5개 공판장만 finalized 체크
  SELECT bool_and(is_finalized) INTO all_finalized
  FROM market_summary
  WHERE market_date = NEW.market_date
    AND market_name IN ('선남농협', '성주원예', '성주조공', '용암농협', '초전농협');

  -- market_aggregate_summary의 is_finalized 업데이트
  UPDATE market_aggregate_summary
  SET is_finalized = COALESCE(all_finalized, false)
  WHERE market_date = NEW.market_date
    AND region_name = '성주군';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
