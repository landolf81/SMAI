-- market_summary, market_aggregate_summary 테이블에 is_finalized 컬럼 추가
-- 목적: 당일 데이터 수집 완료 여부를 추적하여 '집계중' 표시 제어
-- 작성일: 2026-03-16

-- 1. market_summary: 개별 공판장 집계 완료 여부
ALTER TABLE market_summary
  ADD COLUMN IF NOT EXISTS is_finalized boolean NOT NULL DEFAULT false;

-- 2. market_aggregate_summary: 성주군 합계 집계 완료 여부
ALTER TABLE market_aggregate_summary
  ADD COLUMN IF NOT EXISTS is_finalized boolean NOT NULL DEFAULT false;

-- 3. market_aggregate_summary 자동 갱신 트리거
--    market_summary에 upsert 될 때마다 해당 날짜의 성주군 합계를 재계산
CREATE OR REPLACE FUNCTION update_aggregate_summary_finalized()
RETURNS trigger AS $$
DECLARE
  all_finalized boolean;
BEGIN
  -- 해당 날짜의 모든 시장이 finalized인지 확인
  SELECT bool_and(is_finalized) INTO all_finalized
  FROM market_summary
  WHERE market_date = NEW.market_date;

  -- market_aggregate_summary의 is_finalized 업데이트
  UPDATE market_aggregate_summary
  SET is_finalized = COALESCE(all_finalized, false)
  WHERE market_date = NEW.market_date
    AND region_name = '성주군';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거가 있으면 삭제 후 재생성
DROP TRIGGER IF EXISTS trg_update_aggregate_finalized ON market_summary;

CREATE TRIGGER trg_update_aggregate_finalized
  AFTER INSERT OR UPDATE OF is_finalized ON market_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_aggregate_summary_finalized();

DO $$
BEGIN
  RAISE NOTICE '✅ is_finalized 컬럼 및 트리거 생성 완료';
  RAISE NOTICE '  market_summary.is_finalized (boolean, default false)';
  RAISE NOTICE '  market_aggregate_summary.is_finalized (boolean, default false)';
  RAISE NOTICE '  트리거: market_summary 변경 시 aggregate_summary 자동 갱신';
END $$;
