-- 공판장 경매시간 관리 테이블
-- 관리자가 기간별로 경매시간을 등록/수정할 수 있음

CREATE TABLE IF NOT EXISTS market_auction_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_name TEXT NOT NULL,
  auction_time TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE market_auction_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "누구나 조회 가능"
  ON market_auction_times FOR SELECT
  USING (true);

CREATE POLICY "관리자만 삽입"
  ON market_auction_times FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "관리자만 수정"
  ON market_auction_times FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "관리자만 삭제"
  ON market_auction_times FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
  );

-- 인덱스: 특정 날짜의 경매시간 조회 최적화
CREATE INDEX idx_auction_times_lookup
  ON market_auction_times (market_name, effective_from, effective_to);
