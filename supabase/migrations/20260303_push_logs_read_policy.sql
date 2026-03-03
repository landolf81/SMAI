-- 인증 사용자가 push_logs (공지/시세 알림 이력) 읽기 허용
ALTER TABLE push_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_push_logs"
  ON push_logs FOR SELECT
  TO authenticated
  USING (true);
