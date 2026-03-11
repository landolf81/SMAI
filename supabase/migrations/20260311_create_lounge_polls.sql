-- ============================================================
-- 광장 투표(Poll) 기능 마이그레이션
-- 테이블: lounge_polls, lounge_poll_options, lounge_poll_votes
-- 트리거: 투표수 자동 갱신, 단일선택 제약
-- ============================================================

-- 1) 투표 메타데이터
CREATE TABLE IF NOT EXISTS lounge_polls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question    TEXT NOT NULL CHECK (char_length(question) <= 100),
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  is_multiple  BOOLEAN NOT NULL DEFAULT false,
  expires_at   TIMESTAMPTZ,
  is_closed    BOOLEAN NOT NULL DEFAULT false,
  total_votes  INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lounge_polls_user ON lounge_polls(user_id);
CREATE INDEX IF NOT EXISTS idx_lounge_polls_created ON lounge_polls(created_at DESC);

-- 2) 투표 선택지
CREATE TABLE IF NOT EXISTS lounge_poll_options (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID NOT NULL REFERENCES lounge_polls(id) ON DELETE CASCADE,
  label      TEXT NOT NULL CHECK (char_length(label) <= 50),
  sort_order INT NOT NULL DEFAULT 0,
  vote_count INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON lounge_poll_options(poll_id);

-- 3) 개별 투표 기록
CREATE TABLE IF NOT EXISTS lounge_poll_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID NOT NULL REFERENCES lounge_polls(id) ON DELETE CASCADE,
  option_id  UUID NOT NULL REFERENCES lounge_poll_options(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, option_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON lounge_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON lounge_poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON lounge_poll_votes(option_id);

-- 4) lounge_messages에 poll_id 컬럼 추가
ALTER TABLE lounge_messages
  ADD COLUMN IF NOT EXISTS poll_id UUID REFERENCES lounge_polls(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lounge_messages_poll
  ON lounge_messages(poll_id) WHERE poll_id IS NOT NULL;

-- 5) 기존 CHECK 제약조건 수정: poll_id만 있는 메시지도 허용
ALTER TABLE lounge_messages DROP CONSTRAINT IF EXISTS lounge_messages_content_or_image;
ALTER TABLE lounge_messages ADD CONSTRAINT lounge_messages_content_or_image
  CHECK (content IS NOT NULL OR image_url IS NOT NULL OR poll_id IS NOT NULL);

-- ============================================================
-- 트리거 1: 투표 삽입/삭제 시 vote_count, total_votes 자동 갱신
-- ============================================================
CREATE OR REPLACE FUNCTION update_poll_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE lounge_poll_options
      SET vote_count = vote_count + 1
      WHERE id = NEW.option_id;
    UPDATE lounge_polls
      SET total_votes = total_votes + 1
      WHERE id = NEW.poll_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE lounge_poll_options
      SET vote_count = GREATEST(vote_count - 1, 0)
      WHERE id = OLD.option_id;
    UPDATE lounge_polls
      SET total_votes = GREATEST(total_votes - 1, 0)
      WHERE id = OLD.poll_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_poll_vote_counts ON lounge_poll_votes;
CREATE TRIGGER trg_poll_vote_counts
  AFTER INSERT OR DELETE ON lounge_poll_votes
  FOR EACH ROW EXECUTE FUNCTION update_poll_vote_counts();

-- ============================================================
-- 트리거 2: 단일선택 투표 제약 (is_multiple=false일 때)
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_single_choice_poll()
RETURNS TRIGGER AS $$
DECLARE
  v_is_multiple BOOLEAN;
BEGIN
  SELECT is_multiple INTO v_is_multiple
    FROM lounge_polls WHERE id = NEW.poll_id;

  IF NOT v_is_multiple THEN
    IF EXISTS (
      SELECT 1 FROM lounge_poll_votes
        WHERE poll_id = NEW.poll_id
          AND user_id = NEW.user_id
          AND option_id != NEW.option_id
    ) THEN
      RAISE EXCEPTION 'Single-choice poll: already voted for another option';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_single_choice ON lounge_poll_votes;
CREATE TRIGGER trg_enforce_single_choice
  BEFORE INSERT ON lounge_poll_votes
  FOR EACH ROW EXECUTE FUNCTION enforce_single_choice_poll();

-- ============================================================
-- RLS 정책
-- ============================================================

-- lounge_polls
ALTER TABLE lounge_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "polls_select" ON lounge_polls FOR SELECT USING (true);
CREATE POLICY "polls_insert" ON lounge_polls FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "polls_update" ON lounge_polls FOR UPDATE
  USING ((select auth.uid()) = user_id);

-- lounge_poll_options
ALTER TABLE lounge_poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_options_select" ON lounge_poll_options FOR SELECT USING (true);
CREATE POLICY "poll_options_insert" ON lounge_poll_options FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM lounge_polls WHERE id = poll_id AND user_id = (select auth.uid()))
  );

-- lounge_poll_votes
ALTER TABLE lounge_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_votes_select" ON lounge_poll_votes FOR SELECT USING (true);
CREATE POLICY "poll_votes_insert" ON lounge_poll_votes FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "poll_votes_delete" ON lounge_poll_votes FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- Realtime: 투표 변경 감지용
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE lounge_poll_votes;
