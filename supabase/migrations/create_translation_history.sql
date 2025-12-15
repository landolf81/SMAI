-- 번역 히스토리 테이블 생성
CREATE TABLE IF NOT EXISTS translation_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_text TEXT NOT NULL,
  input_lang VARCHAR(10) NOT NULL,
  target_lang VARCHAR(10) NOT NULL,
  target_translation TEXT NOT NULL,
  back_translation TEXT NOT NULL,
  audio_url TEXT, -- R2에 저장된 오디오 URL
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_translation_history_user_id ON translation_history(user_id);
CREATE INDEX idx_translation_history_created_at ON translation_history(created_at DESC);

-- RLS 정책 설정
ALTER TABLE translation_history ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 번역 히스토리만 조회 가능
CREATE POLICY "Users can view own translation history"
  ON translation_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 자신의 번역 히스토리만 생성 가능
CREATE POLICY "Users can create own translation history"
  ON translation_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 번역 히스토리만 삭제 가능
CREATE POLICY "Users can delete own translation history"
  ON translation_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- 관리자는 모든 번역 히스토리 조회 가능 (profiles 테이블이 있다면)
-- CREATE POLICY "Admins can view all translation history"
--   ON translation_history
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--       AND profiles.role = 'admin'
--     )
--   );

-- 100개 제한을 위한 함수 (트리거)
CREATE OR REPLACE FUNCTION delete_old_translation_history()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM translation_history
  WHERE user_id = NEW.user_id
  AND id NOT IN (
    SELECT id FROM translation_history
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    LIMIT 100
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (새 번역 추가 시 100개 초과분 자동 삭제)
CREATE TRIGGER trigger_delete_old_translation_history
AFTER INSERT ON translation_history
FOR EACH ROW
EXECUTE FUNCTION delete_old_translation_history();
