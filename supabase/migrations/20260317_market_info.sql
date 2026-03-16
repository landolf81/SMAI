-- market_info: 공판장 상세 정보 (경매시간, 주소, 연락처 등)
-- 어드민이 관리, 모든 사용자 읽기 가능
-- transport_teams: [{name: "팀명", phone: "번호"}, ...] JSON 배열
-- 작성일: 2026-03-17

CREATE TABLE IF NOT EXISTS market_info (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  market_name text NOT NULL UNIQUE,
  address text,
  auction_hours text,
  phone text,
  transport_teams jsonb DEFAULT '[]'::jsonb,
  memo text,
  updated_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE market_info ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 읽기 가능
CREATE POLICY "market_info_read_all" ON market_info
  FOR SELECT USING (true);

-- 관리자만 쓰기 가능
CREATE POLICY "market_info_write_admin" ON market_info
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );
