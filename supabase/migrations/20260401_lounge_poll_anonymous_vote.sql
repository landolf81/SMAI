-- ============================================================
-- 광장 투표 비로그인 투표 지원 마이그레이션
-- 변경: user_id nullable + session_id 추가 + RLS/트리거 수정
-- ============================================================

-- 1) user_id를 nullable로 변경
ALTER TABLE lounge_poll_votes ALTER COLUMN user_id DROP NOT NULL;

-- 2) session_id 컬럼 추가 (비로그인 식별용)
ALTER TABLE lounge_poll_votes
  ADD COLUMN IF NOT EXISTS session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_poll_votes_session
  ON lounge_poll_votes(session_id) WHERE session_id IS NOT NULL;

-- 3) user_id 또는 session_id 중 하나는 필수
ALTER TABLE lounge_poll_votes DROP CONSTRAINT IF EXISTS chk_vote_identity;
ALTER TABLE lounge_poll_votes ADD CONSTRAINT chk_vote_identity
  CHECK (user_id IS NOT NULL OR session_id IS NOT NULL);

-- 4) 기존 UNIQUE 제약 수정 (user_id만 있던 것 → 2개로 분리)
ALTER TABLE lounge_poll_votes DROP CONSTRAINT IF EXISTS lounge_poll_votes_poll_id_option_id_user_id_key;

-- user_id 기반 유니크 (로그인 유저)
CREATE UNIQUE INDEX IF NOT EXISTS uq_poll_votes_user
  ON lounge_poll_votes(poll_id, option_id, user_id) WHERE user_id IS NOT NULL;

-- session_id 기반 유니크 (비로그인)
CREATE UNIQUE INDEX IF NOT EXISTS uq_poll_votes_session
  ON lounge_poll_votes(poll_id, option_id, session_id) WHERE session_id IS NOT NULL;

-- 5) RLS 정책 수정: 비로그인도 INSERT/DELETE 허용
DROP POLICY IF EXISTS "poll_votes_insert" ON lounge_poll_votes;
CREATE POLICY "poll_votes_insert" ON lounge_poll_votes FOR INSERT
  WITH CHECK (
    (user_id IS NOT NULL AND (select auth.uid()) = user_id)
    OR
    (user_id IS NULL AND session_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "poll_votes_delete" ON lounge_poll_votes;
CREATE POLICY "poll_votes_delete" ON lounge_poll_votes FOR DELETE
  USING (
    (user_id IS NOT NULL AND (select auth.uid()) = user_id)
    OR
    (user_id IS NULL AND session_id IS NOT NULL)
  );

-- 6) 단일선택 트리거 수정: session_id도 고려
CREATE OR REPLACE FUNCTION enforce_single_choice_poll()
RETURNS TRIGGER AS $$
DECLARE
  v_is_multiple BOOLEAN;
BEGIN
  SELECT is_multiple INTO v_is_multiple
    FROM lounge_polls WHERE id = NEW.poll_id;

  IF NOT v_is_multiple THEN
    IF NEW.user_id IS NOT NULL THEN
      -- 로그인 유저: user_id로 중복 체크
      IF EXISTS (
        SELECT 1 FROM lounge_poll_votes
          WHERE poll_id = NEW.poll_id
            AND user_id = NEW.user_id
            AND option_id != NEW.option_id
      ) THEN
        RAISE EXCEPTION 'Single-choice poll: already voted for another option';
      END IF;
    ELSIF NEW.session_id IS NOT NULL THEN
      -- 비로그인: session_id로 중복 체크
      IF EXISTS (
        SELECT 1 FROM lounge_poll_votes
          WHERE poll_id = NEW.poll_id
            AND session_id = NEW.session_id
            AND option_id != NEW.option_id
      ) THEN
        RAISE EXCEPTION 'Single-choice poll: already voted for another option';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
