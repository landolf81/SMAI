-- 도매시장 합계 트리거에서 구리공판장 제외 추가
-- 기존 제외: 선남농협, 성주원예, 성주조공, 용암농협, 초전농협, 가락공판장, 대전공판장, 광주공판장
-- 추가 제외: 구리공판장
-- 작성일: 2026-03-23

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. 도매시장 합계 집계 함수 재생성 (구리공판장 제외 추가)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_wholesale_aggregate_summary()
RETURNS trigger AS $$
DECLARE
  v_total_boxes     BIGINT;
  v_total_amount    BIGINT;
  v_avg_price       INTEGER;
  v_max_price       INTEGER;
  v_min_price       INTEGER;
  v_is_finalized    BOOLEAN;
  -- 도매시장 집계에서 제외할 시장 목록 (성주 내부 5개 + 외부 4개 공판장)
  EXCLUDE_MARKETS   TEXT[] := ARRAY[
    '선남농협', '성주원예', '성주조공', '용암농협', '초전농협',
    '가락공판장', '구리공판장', '대전공판장', '광주공판장'
  ];
BEGIN
  -- 해당 날짜의 도매시장 합계 계산 (제외 시장 제외)
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

  -- 도매시장 구성 시장의 is_finalized: 모두 finalized여야 최종 확정
  SELECT bool_and(is_finalized) INTO v_is_finalized
  FROM market_summary
  WHERE market_date = NEW.market_date
    AND market_name != ALL(EXCLUDE_MARKETS);

  -- market_aggregate_summary에 upsert (region_name = '도매시장')
  INSERT INTO market_aggregate_summary (
    market_date,
    region_name,
    total_boxes,
    total_amount,
    avg_price,
    max_price,
    min_price,
    is_finalized
  )
  VALUES (
    NEW.market_date,
    '도매시장',
    v_total_boxes,
    v_total_amount,
    v_avg_price,
    v_max_price,
    v_min_price,
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
-- 2. 기존 데이터 백필 (구리공판장 제외하여 재집계)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO market_aggregate_summary (
  market_date,
  region_name,
  total_boxes,
  total_amount,
  avg_price,
  max_price,
  min_price,
  is_finalized
)
SELECT
  market_date,
  '도매시장' AS region_name,
  COALESCE(SUM(total_boxes), 0)::BIGINT                                              AS total_boxes,
  COALESCE(SUM(total_amount), 0)::BIGINT                                             AS total_amount,
  CASE
    WHEN COALESCE(SUM(total_boxes), 0) > 0
    THEN (SUM(total_amount) / SUM(total_boxes))::INTEGER
    ELSE 0
  END                                                                                AS avg_price,
  COALESCE(MAX(max_price), 0)::INTEGER                                               AS max_price,
  COALESCE(MIN(CASE WHEN min_price > 0 THEN min_price ELSE NULL END), 0)::INTEGER    AS min_price,
  bool_and(is_finalized)                                                             AS is_finalized
FROM market_summary
WHERE market_name != ALL(ARRAY[
  '선남농협', '성주원예', '성주조공', '용암농협', '초전농협',
  '가락공판장', '구리공판장', '대전공판장', '광주공판장'
])
GROUP BY market_date
ON CONFLICT (market_date, region_name)
DO UPDATE SET
  total_boxes  = EXCLUDED.total_boxes,
  total_amount = EXCLUDED.total_amount,
  avg_price    = EXCLUDED.avg_price,
  max_price    = EXCLUDED.max_price,
  min_price    = EXCLUDED.min_price,
  is_finalized = EXCLUDED.is_finalized;

DO $$
BEGIN
  RAISE NOTICE '✅ 도매시장 합계 트리거 업데이트 완료 (구리공판장 제외 추가)';
  RAISE NOTICE '  제외 시장: 선남농협, 성주원예, 성주조공, 용암농협, 초전농협, 가락공판장, 구리공판장, 대전공판장, 광주공판장';
END $$;
