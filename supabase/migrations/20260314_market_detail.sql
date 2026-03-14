-- market_detail: 도매시장 법인별 규격+출하지명 상세 데이터
-- market_data (등급/무게별 집계)보다 한 단계 아래의 세부 거래 정보
-- 용도: Prices 페이지에서 법인명 카드 클릭 시 모달로 상세 내역 표시

CREATE TABLE IF NOT EXISTS market_detail (
  id BIGSERIAL PRIMARY KEY,
  market_name TEXT NOT NULL,        -- 시장명 (market_data.market_name과 매칭)
  market_date DATE NOT NULL,        -- 경매일자
  grade TEXT NOT NULL,              -- 등급/법인명 (market_data.grade와 매칭)
  weight TEXT NOT NULL,             -- 규격 (5kg, 10kg 등)
  shipper_name TEXT NOT NULL,       -- 출하지명
  avg_price INTEGER DEFAULT 0,     -- 평균가
  max_price INTEGER DEFAULT 0,     -- 최고가
  min_price INTEGER DEFAULT 0,     -- 최저가
  boxes INTEGER DEFAULT 0,         -- 수량(상자)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 조회 인덱스: 시장명 + 날짜 + 등급(법인명) 기준 조회
CREATE INDEX IF NOT EXISTS idx_market_detail_lookup
  ON market_detail (market_name, market_date, grade);

-- RLS 활성화 및 읽기 정책
ALTER TABLE market_detail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_detail_read" ON market_detail
  FOR SELECT USING (true);
