-- 광장 메시지 숨기기 기능 (관리자용)
ALTER TABLE lounge_messages ADD COLUMN is_hidden BOOLEAN DEFAULT false;

-- 관리자가 메시지를 숨기기/복구할 수 있도록 UPDATE 정책 추가
CREATE POLICY "lounge_admin_update"
  ON lounge_messages FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
  );
