-- 광장 (단체 채팅방) 테이블
-- 작성일: 2026-03-01
-- 용도: 회원들이 짧은 텍스트 글을 실시간으로 공유하는 공간

CREATE TABLE IF NOT EXISTS lounge_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 300),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE lounge_messages ENABLE ROW LEVEL SECURITY;

-- 모든 사람이 읽기 가능
CREATE POLICY "lounge_select_all"
  ON lounge_messages FOR SELECT
  USING (true);

-- 인증된 사용자만 작성 (본인 ID로만)
CREATE POLICY "lounge_insert_auth"
  ON lounge_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 메시지만 삭제 가능
CREATE POLICY "lounge_delete_own"
  ON lounge_messages FOR DELETE
  USING (auth.uid() = user_id);

-- 최신순 정렬 인덱스
CREATE INDEX IF NOT EXISTS idx_lounge_created_at
  ON lounge_messages(created_at DESC);

-- Realtime 활성화 (Supabase Dashboard에서 lounge_messages 테이블 Publication 추가 필요)

DO $$
BEGIN
  RAISE NOTICE '✅ lounge_messages 테이블 생성 완료';
  RAISE NOTICE '⚠️  Supabase Dashboard > Database > Replication에서 lounge_messages 테이블을 supabase_realtime publication에 추가해야 함';
END $$;
