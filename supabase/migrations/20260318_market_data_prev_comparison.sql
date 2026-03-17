-- market_data에 전일 비교 컬럼 추가 + 자동 계산 트리거
-- market_summary에도 전체 평균가 비교 컬럼 추가
-- 목적: Prices 페이지 조회 시 5번 순차 API → 2번 병렬 조회로 단축

-- ============================================================
-- 1. market_data 비교 컬럼 추가
-- ============================================================
ALTER TABLE market_data
  ADD COLUMN IF NOT EXISTS prev_avg_price INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prev_max_price INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prev_min_price INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prev_boxes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prev_market_date DATE;

-- ============================================================
-- 2. market_summary 비교 컬럼 추가
-- ============================================================
ALTER TABLE market_summary
  ADD COLUMN IF NOT EXISTS prev_avg_price INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prev_total_boxes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prev_market_date DATE;

-- ============================================================
-- 3. market_data 트리거 함수: INSERT/UPDATE 시 전 경매일 데이터 자동 매칭
-- ============================================================
CREATE OR REPLACE FUNCTION fn_market_data_set_prev_comparison()
RETURNS TRIGGER AS $$
DECLARE
  prev_row RECORD;
  prev_date DATE;
BEGIN
  -- 전 경매일 찾기 (같은 시장, 현재 날짜보다 이전 중 최근)
  SELECT market_date INTO prev_date
  FROM market_data
  WHERE market_name = NEW.market_name
    AND market_date < NEW.market_date
  ORDER BY market_date DESC
  LIMIT 1;

  IF prev_date IS NOT NULL THEN
    -- 전 경매일의 같은 등급+무게 데이터 조회
    SELECT avg_price, max_price, min_price, boxes
    INTO prev_row
    FROM market_data
    WHERE market_name = NEW.market_name
      AND market_date = prev_date
      AND grade = NEW.grade
      AND weight = NEW.weight
    LIMIT 1;

    IF FOUND THEN
      NEW.prev_avg_price := COALESCE(prev_row.avg_price, 0);
      NEW.prev_max_price := COALESCE(prev_row.max_price, 0);
      NEW.prev_min_price := COALESCE(prev_row.min_price, 0);
      NEW.prev_boxes := COALESCE(prev_row.boxes, 0);
      NEW.prev_market_date := prev_date;
    ELSE
      NEW.prev_avg_price := 0;
      NEW.prev_max_price := 0;
      NEW.prev_min_price := 0;
      NEW.prev_boxes := 0;
      NEW.prev_market_date := prev_date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_market_data_prev_comparison ON market_data;
CREATE TRIGGER trg_market_data_prev_comparison
  BEFORE INSERT OR UPDATE ON market_data
  FOR EACH ROW
  EXECUTE FUNCTION fn_market_data_set_prev_comparison();

-- ============================================================
-- 4. market_summary 트리거 함수: INSERT/UPDATE 시 전 경매일 요약 자동 매칭
-- ============================================================
CREATE OR REPLACE FUNCTION fn_market_summary_set_prev_comparison()
RETURNS TRIGGER AS $$
DECLARE
  prev_row RECORD;
  prev_date DATE;
BEGIN
  -- 전 경매일 찾기
  SELECT market_date INTO prev_date
  FROM market_summary
  WHERE market_name = NEW.market_name
    AND market_date < NEW.market_date
  ORDER BY market_date DESC
  LIMIT 1;

  IF prev_date IS NOT NULL THEN
    SELECT avg_price, total_boxes
    INTO prev_row
    FROM market_summary
    WHERE market_name = NEW.market_name
      AND market_date = prev_date
    LIMIT 1;

    IF FOUND THEN
      NEW.prev_avg_price := COALESCE(prev_row.avg_price, 0);
      NEW.prev_total_boxes := COALESCE(prev_row.total_boxes, 0);
      NEW.prev_market_date := prev_date;
    ELSE
      NEW.prev_avg_price := 0;
      NEW.prev_total_boxes := 0;
      NEW.prev_market_date := prev_date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_market_summary_prev_comparison ON market_summary;
CREATE TRIGGER trg_market_summary_prev_comparison
  BEFORE INSERT OR UPDATE ON market_summary
  FOR EACH ROW
  EXECUTE FUNCTION fn_market_summary_set_prev_comparison();

-- ============================================================
-- 5. 기존 데이터 백필 (한번만 실행)
-- ============================================================

-- market_data 백필 (복합키 사용: market_name + market_date + grade + weight)
UPDATE market_data md
SET
  prev_market_date = sub.prev_date,
  prev_avg_price = COALESCE(prev.avg_price, 0),
  prev_max_price = COALESCE(prev.max_price, 0),
  prev_min_price = COALESCE(prev.min_price, 0),
  prev_boxes = COALESCE(prev.boxes, 0)
FROM (
  SELECT market_name, market_date, grade, weight,
    (SELECT MAX(md2.market_date) FROM market_data md2
     WHERE md2.market_name = market_data.market_name
       AND md2.market_date < market_data.market_date) AS prev_date
  FROM market_data
) sub
LEFT JOIN market_data prev
  ON prev.market_name = sub.market_name
  AND prev.market_date = sub.prev_date
  AND prev.grade = sub.grade
  AND prev.weight = sub.weight
WHERE md.market_name = sub.market_name
  AND md.market_date = sub.market_date
  AND md.grade = sub.grade
  AND md.weight = sub.weight
  AND sub.prev_date IS NOT NULL;

-- market_summary 백필 (복합키 사용: market_name + market_date)
UPDATE market_summary ms
SET
  prev_market_date = sub.prev_date,
  prev_avg_price = COALESCE(prev.avg_price, 0),
  prev_total_boxes = COALESCE(prev.total_boxes, 0)
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
  RAISE NOTICE '✅ market_data/market_summary 전일 비교 컬럼 추가 + 트리거 생성 + 백필 완료';
END $$;
