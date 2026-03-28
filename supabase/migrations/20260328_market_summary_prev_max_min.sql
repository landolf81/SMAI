-- market_summary에 prev_max_price, prev_min_price 컬럼 추가
-- 목적: 즐겨찾기 화면에서 전체(summary) 타입의 최고가/최저가 변동값 표시

-- ============================================================
-- 1. market_summary에 누락된 비교 컬럼 추가
-- ============================================================
ALTER TABLE market_summary
  ADD COLUMN IF NOT EXISTS prev_max_price INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prev_min_price INTEGER DEFAULT 0;

-- ============================================================
-- 2. 트리거 함수 업데이트: max_price, min_price도 전일 비교 포함
-- ============================================================
CREATE OR REPLACE FUNCTION fn_market_summary_set_prev_comparison()
RETURNS TRIGGER AS $$
DECLARE
  prev_row RECORD;
  prev_date DATE;
BEGIN
  SELECT market_date INTO prev_date
  FROM market_summary
  WHERE market_name = NEW.market_name
    AND market_date < NEW.market_date
  ORDER BY market_date DESC
  LIMIT 1;

  IF prev_date IS NOT NULL THEN
    SELECT avg_price, total_boxes, max_price, min_price
    INTO prev_row
    FROM market_summary
    WHERE market_name = NEW.market_name
      AND market_date = prev_date
    LIMIT 1;

    IF FOUND THEN
      NEW.prev_avg_price := COALESCE(prev_row.avg_price, 0);
      NEW.prev_total_boxes := COALESCE(prev_row.total_boxes, 0);
      NEW.prev_max_price := COALESCE(prev_row.max_price, 0);
      NEW.prev_min_price := COALESCE(prev_row.min_price, 0);
      NEW.prev_market_date := prev_date;
    ELSE
      NEW.prev_avg_price := 0;
      NEW.prev_total_boxes := 0;
      NEW.prev_max_price := 0;
      NEW.prev_min_price := 0;
      NEW.prev_market_date := prev_date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 재생성
DROP TRIGGER IF EXISTS trg_market_summary_prev_comparison ON market_summary;
CREATE TRIGGER trg_market_summary_prev_comparison
  BEFORE INSERT OR UPDATE ON market_summary
  FOR EACH ROW
  EXECUTE FUNCTION fn_market_summary_set_prev_comparison();

-- ============================================================
-- 3. 기존 데이터 백필
-- ============================================================
UPDATE market_summary ms
SET
  prev_max_price = COALESCE(prev.max_price, 0),
  prev_min_price = COALESCE(prev.min_price, 0)
FROM (
  SELECT market_name, market_date,
    (SELECT MAX(ms2.market_date) FROM market_summary ms2
     WHERE ms2.market_name = market_summary.market_name
       AND ms2.market_date < market_summary.market_date) AS prev_date
  FROM market_summary
) sub
LEFT JOIN market_summary prev
  ON prev.market_name = sub.market_name
  AND prev.market_date = sub.prev_date
WHERE ms.market_name = sub.market_name
  AND ms.market_date = sub.market_date
  AND sub.prev_date IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '✅ market_summary prev_max_price/prev_min_price 추가 + 트리거 업데이트 + 백필 완료';
END $$;
