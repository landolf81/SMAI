-- 도매시장 합계 트리거 수정
-- 문제 1: 제외 시장(성주 5개 + 외부 4개)이 변경돼도 트리거가 발동하여 0짜리 합계 row 생성
-- 문제 2: 합계 결과가 0이어도 row를 그대로 upsert → 휴장일·미수집일에 phantom 합계 발생
-- 수정 방향:
--   - NEW.market_name이 제외 시장이면 즉시 RETURN (도매시장 합계와 무관)
--   - 계산 결과 total_boxes = 0이면 기존 row를 DELETE (있으면) 후 RETURN
-- 작성일: 2026-04-28

CREATE OR REPLACE FUNCTION update_wholesale_aggregate_summary()
RETURNS trigger AS $$
DECLARE
  v_total_boxes     BIGINT;
  v_total_amount    BIGINT;
  v_avg_price       INTEGER;
  v_max_price       INTEGER;
  v_min_price       INTEGER;
  v_is_finalized    BOOLEAN;
  EXCLUDE_MARKETS   TEXT[] := ARRAY[
    '선남농협', '성주원예', '성주조공', '용암농협', '초전농협',
    '가락공판장', '구리공판장', '대전공판장', '광주공판장'
  ];
BEGIN
  -- ① 제외 시장의 행은 도매시장 합계와 무관 → skip
  IF NEW.market_name = ANY(EXCLUDE_MARKETS) THEN
    RETURN NEW;
  END IF;

  -- ② 도매시장 합계 계산 (제외 시장 제외)
  SELECT
    COALESCE(SUM(total_boxes), 0)::BIGINT,
    COALESCE(SUM(total_amount), 0)::BIGINT,
    CASE
      WHEN COALESCE(SUM(total_boxes), 0) > 0
      THEN (SUM(total_amount) / SUM(total_boxes))::INTEGER
      ELSE 0
    END,
    COALESCE(MAX(max_price), 0)::INTEGER,
    COALESCE(MIN(CASE WHEN min_price > 0 THEN min_price ELSE NULL END), 0)::INTEGER
  INTO
    v_total_boxes,
    v_total_amount,
    v_avg_price,
    v_max_price,
    v_min_price
  FROM market_summary
  WHERE market_date = NEW.market_date
    AND market_name != ALL(EXCLUDE_MARKETS);

  -- ③ 합계가 0이면 기존 row 제거 (휴장일·전체 미수집일 정리)
  IF v_total_boxes = 0 THEN
    DELETE FROM market_aggregate_summary
    WHERE market_date = NEW.market_date
      AND region_name = '도매시장';
    RETURN NEW;
  END IF;

  -- ④ is_finalized 판정
  SELECT bool_and(is_finalized) INTO v_is_finalized
  FROM market_summary
  WHERE market_date = NEW.market_date
    AND market_name != ALL(EXCLUDE_MARKETS);

  -- ⑤ upsert
  INSERT INTO market_aggregate_summary (
    market_date, region_name,
    total_boxes, total_amount, avg_price, max_price, min_price,
    is_finalized
  )
  VALUES (
    NEW.market_date, '도매시장',
    v_total_boxes, v_total_amount, v_avg_price, v_max_price, v_min_price,
    COALESCE(v_is_finalized, false)
  )
  ON CONFLICT (market_date, region_name)
  DO UPDATE SET
    total_boxes  = EXCLUDED.total_boxes,
    total_amount = EXCLUDED.total_amount,
    avg_price    = EXCLUDED.avg_price,
    max_price    = EXCLUDED.max_price,
    min_price    = EXCLUDED.min_price,
    is_finalized = EXCLUDED.is_finalized;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 기존에 잘못 생성된 0짜리 도매시장 합계 row 정리
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM market_aggregate_summary
WHERE region_name = '도매시장'
  AND COALESCE(total_boxes, 0) = 0;

DO $$
BEGIN
  RAISE NOTICE '✅ 도매시장 합계 트리거 수정 완료';
  RAISE NOTICE '  - 제외 시장 변경 시 트리거 skip';
  RAISE NOTICE '  - 합계 0이면 row 삭제';
  RAISE NOTICE '  - 기존 0짜리 row 정리 완료';
END $$;
