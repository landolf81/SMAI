-- user_notifications 테이블 생성
-- 용도: 개인별 알림 (댓글/답글, 좋아요, 멘션, DM)
-- 작성일: 2026-03-24

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('comment', 'reply', 'like', 'mention', 'dm')),
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  reference_id UUID,
  reference_type TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- 본인 알림만 조회
CREATE POLICY "notification_select_own"
  ON user_notifications FOR SELECT
  USING (auth.uid() = receiver_id);

-- 인증 사용자가 알림 생성 (sender_id = 본인)
CREATE POLICY "notification_insert_auth"
  ON user_notifications FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- 본인 알림만 수정 (읽음 처리)
CREATE POLICY "notification_update_own"
  ON user_notifications FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- 본인 알림만 삭제
CREATE POLICY "notification_delete_own"
  ON user_notifications FOR DELETE
  USING (auth.uid() = receiver_id);

-- 인덱스: receiver별 최신순 조회 최적화
CREATE INDEX IF NOT EXISTS idx_user_notifications_receiver_created
  ON user_notifications(receiver_id, created_at DESC);

-- 인덱스: 미읽은 알림 카운트 최적화
CREATE INDEX IF NOT EXISTS idx_user_notifications_receiver_unread
  ON user_notifications(receiver_id, is_read) WHERE is_read = false;

-- 중복 알림 방지 (같은 sender가 같은 reference에 같은 type 알림)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notifications_dedup
  ON user_notifications(receiver_id, sender_id, type, reference_id, reference_type);
