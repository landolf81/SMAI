-- 별명 변경 이력 테이블
-- 사용자가 별명을 변경할 때마다 이전/이후 값을 기록
CREATE TABLE IF NOT EXISTS nickname_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_name text NOT NULL,
  new_name text NOT NULL,
  changed_at timestamptz DEFAULT now()
);

-- 인덱스: 사용자별 변경 이력 조회
CREATE INDEX IF NOT EXISTS idx_nickname_history_user_id ON nickname_history(user_id);

-- 인덱스: 최신순 정렬 조회 (관리자 대시보드용)
CREATE INDEX IF NOT EXISTS idx_nickname_history_changed_at ON nickname_history(changed_at DESC);

-- RLS 정책
ALTER TABLE nickname_history ENABLE ROW LEVEL SECURITY;

-- 관리자: 전체 조회 가능
CREATE POLICY "admins_read_nickname_history"
  ON nickname_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
    )
  );

-- 본인: 자기 이력만 조회
CREATE POLICY "users_read_own_nickname_history"
  ON nickname_history FOR SELECT
  USING (user_id = auth.uid());

-- 인증 사용자: 자기 이력만 삽입
CREATE POLICY "users_insert_own_nickname_history"
  ON nickname_history FOR INSERT
  WITH CHECK (user_id = auth.uid());
