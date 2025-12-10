-- app_settings 테이블 생성 (이미 존재하면 무시)
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책 설정
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있음
CREATE POLICY "Anyone can read app_settings" ON app_settings
  FOR SELECT USING (true);

-- 관리자만 수정 가능 (admin_roles 테이블 참조)
CREATE POLICY "Admins can update app_settings" ON app_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert app_settings" ON app_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
