-- market_detail_grade: 도매시장 법인별 출하지+규격+등급별 세분화 데이터
-- market_detail 보다 한 단계 더 세분화된 테이블 (등급·크기규격 포함)
-- 업로드 주기: T+1 (경매 다음날 업로드)
-- 용도: 법인별 등급·규격·출하지 단위의 낙찰 통계 조회 및 전일 대비 비교

-- ============================================================
-- 1. 테이블 생성
-- ============================================================
CREATE TABLE IF NOT EXISTS market_detail_grade (
  market_date       DATE         NOT NULL,              -- 경매일
  market_name       TEXT         NOT NULL,              -- 법인명 (㈜중앙청과, 동화청과㈜ 등)
  region_name       TEXT         NOT NULL,              -- 도매시장명 (서울가락)
  shipper           TEXT         NOT NULL,              -- 출하지명 (경상북도 성주군)
  weight            TEXT         NOT NULL,              -- 규격 (10kg, 5kg 등, unit_qty에서 변환)
  grade             TEXT         NOT NULL,              -- 등급 (특, 상, 보통, 등외, .)
  size_name         TEXT         NOT NULL DEFAULT '.',  -- 크기규격 (30내, 40내, . 등)
  boxes             INTEGER      NOT NULL DEFAULT 0,    -- 수량
  max_price         INTEGER      NOT NULL DEFAULT 0,    -- 최고가
  min_price         INTEGER      NOT NULL DEFAULT 0,    -- 최저가
  avg_price         INTEGER      NOT NULL DEFAULT 0,    -- 평균가

  -- 전일 비교 컬럼 (트리거로 자동 채움)
  prev_market_date  DATE,                               -- 전 경매일
  prev_boxes        INTEGER      DEFAULT 0,             -- 전일 수량
  prev_max_price    INTEGER      DEFAULT 0,             -- 전일 최고가
  prev_min_price    INTEGER      DEFAULT 0,             -- 전일 최저가
  prev_avg_price    INTEGER      DEFAULT 0,             -- 전일 평균가

  created_at        TIMESTAMPTZ  DEFAULT now(),

  -- 복합 PK: 동일 날짜·법인·출하지·규격·등급·크기규격 조합은 유일
  PRIMARY KEY (market_date, market_name, shipper, weight, grade, size_name)
);

-- ============================================================
-- 2. 인덱스
-- ============================================================

-- 날짜 단독 조회 (특정일 전체 데이터 조회)
CREATE INDEX IF NOT EXISTS idx_market_detail_grade_date
  ON market_detail_grade (market_date);

-- 법인명 + 날짜 조회 (법인별 날짜 필터)
CREATE INDEX IF NOT EXISTS idx_market_detail_grade_name_date
  ON market_detail_grade (market_name, market_date);

-- 출하지 + 날짜 조회 (성주군 등 특정 출하지 필터)
CREATE INDEX IF NOT EXISTS idx_market_detail_grade_shipper
  ON market_detail_grade (shipper, market_date);

-- ============================================================
-- 3. 전일 비교 자동 채움 트리거
--    INSERT / UPDATE 시 같은 조합(법인+출하지+규격+등급+크기)에서
--    market_date < NEW.market_date 중 가장 최근 행을 찾아 prev_* 채움
-- ============================================================
CREATE OR REPLACE FUNCTION fn_fill_market_detail_grade_prev()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_prev RECORD;
BEGIN
  -- 동일 조합 중 현재 날짜보다 과거인 행 중 가장 최근 1건 조회
  SELECT
    market_date,
    boxes,
    max_price,
    min_price,
    avg_price
  INTO v_prev
  FROM market_detail_grade
  WHERE
    market_name = NEW.market_name
    AND shipper  = NEW.shipper
    AND weight   = NEW.weight
    AND grade    = NEW.grade
    AND size_name = NEW.size_name
    AND market_date < NEW.market_date
  ORDER BY market_date DESC
  LIMIT 1;

  IF FOUND THEN
    NEW.prev_market_date := v_prev.market_date;
    NEW.prev_boxes       := v_prev.boxes;
    NEW.prev_max_price   := v_prev.max_price;
    NEW.prev_min_price   := v_prev.min_price;
    NEW.prev_avg_price   := v_prev.avg_price;
  ELSE
    -- 이전 데이터 없을 경우 NULL / 0 유지
    NEW.prev_market_date := NULL;
    NEW.prev_boxes       := 0;
    NEW.prev_max_price   := 0;
    NEW.prev_min_price   := 0;
    NEW.prev_avg_price   := 0;
  END IF;

  RETURN NEW;
END;
$$;

-- 기존 트리거가 있을 경우 삭제 후 재생성 (멱등성 보장)
DROP TRIGGER IF EXISTS trg_fill_market_detail_grade_prev ON market_detail_grade;

CREATE TRIGGER trg_fill_market_detail_grade_prev
  BEFORE INSERT OR UPDATE
  ON market_detail_grade
  FOR EACH ROW
  EXECUTE FUNCTION fn_fill_market_detail_grade_prev();

-- ============================================================
-- 4. RLS (Row Level Security)
--    SELECT: anon / authenticated 모두 허용
--    INSERT / UPDATE / DELETE: service_role 전용 (정책 없이 RLS 기본 차단)
-- ============================================================
ALTER TABLE market_detail_grade ENABLE ROW LEVEL SECURITY;

-- anon 읽기 허용
CREATE POLICY "market_detail_grade_select_anon"
  ON market_detail_grade
  FOR SELECT
  TO anon
  USING (true);

-- authenticated 읽기 허용
CREATE POLICY "market_detail_grade_select_authenticated"
  ON market_detail_grade
  FOR SELECT
  TO authenticated
  USING (true);

-- service_role 은 RLS 우회(bypass) 권한을 가지므로 별도 정책 불필요
-- INSERT / UPDATE / DELETE 는 service_role 만 실행 가능
