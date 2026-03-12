-- ============================================================
-- 광고 투표 비로그인(세션 기반) 투표 지원 마이그레이션
-- - user_id nullable + session_id 컬럼 추가
-- - partial unique index로 인증/비인증 각각 중복 방지
-- - RLS: 로그인 유저 + 비로그인(session_id) 모두 허용
-- - 단일선택 트리거: session_id 대응
-- ============================================================

-- 1) user_id를 nullable로 변경 + FK 제거 (비로그인 사용자는 auth.users에 없으므로)
ALTER TABLE ad_poll_votes ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE ad_poll_votes DROP CONSTRAINT IF EXISTS ad_poll_votes_user_id_fkey;

-- 2) session_id 컬럼 추가 (비로그인 사용자 식별용, localStorage UUID)
ALTER TABLE ad_poll_votes ADD COLUMN IF NOT EXISTS session_id TEXT;

-- 3) 기존 UNIQUE 제약 교체 → partial unique index
--    - 로그인 유저: (poll_id, option_id, user_id) 중복 방지
--    - 비로그인: (poll_id, option_id, session_id) 중복 방지
ALTER TABLE ad_poll_votes DROP CONSTRAINT IF EXISTS ad_poll_votes_poll_id_option_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_poll_votes_user_unique
  ON ad_poll_votes (poll_id, option_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_poll_votes_session_unique
  ON ad_poll_votes (poll_id, option_id, session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ad_poll_votes_session
  ON ad_poll_votes (session_id)
  WHERE session_id IS NOT NULL;

-- 4) RLS: 기존 insert/delete 정책 교체
DROP POLICY IF EXISTS "ad_poll_votes_insert" ON ad_poll_votes;
DROP POLICY IF EXISTS "ad_poll_votes_delete" ON ad_poll_votes;

-- 로그인 유저: 기존과 동일 (auth.uid() = user_id)
CREATE POLICY "ad_poll_votes_auth_insert" ON ad_poll_votes FOR INSERT
  WITH CHECK (user_id IS NOT NULL AND (select auth.uid()) = user_id);

CREATE POLICY "ad_poll_votes_auth_delete" ON ad_poll_votes FOR DELETE
  USING (user_id IS NOT NULL AND (select auth.uid()) = user_id);

-- 비로그인: session_id 필수, user_id는 NULL
CREATE POLICY "ad_poll_votes_anon_insert" ON ad_poll_votes FOR INSERT
  WITH CHECK (user_id IS NULL AND session_id IS NOT NULL);

CREATE POLICY "ad_poll_votes_anon_delete" ON ad_poll_votes FOR DELETE
  USING (user_id IS NULL AND session_id IS NOT NULL);

-- 5) 단일선택 트리거 수정: user_id 또는 session_id 기반으로 중복 체크
CREATE OR REPLACE FUNCTION enforce_single_choice_ad_poll()
RETURNS TRIGGER AS $$
DECLARE
  v_is_multiple BOOLEAN;
BEGIN
  SELECT is_multiple INTO v_is_multiple
    FROM ad_polls WHERE id = NEW.poll_id;

  IF NOT v_is_multiple THEN
    IF NEW.user_id IS NOT NULL THEN
      -- 로그인 유저: user_id 기반 체크
      IF EXISTS (
        SELECT 1 FROM ad_poll_votes
          WHERE poll_id   = NEW.poll_id
            AND user_id   = NEW.user_id
            AND option_id != NEW.option_id
      ) THEN
        RAISE EXCEPTION 'Single-choice ad poll: already voted for another option';
      END IF;
    ELSIF NEW.session_id IS NOT NULL THEN
      -- 비로그인: session_id 기반 체크
      IF EXISTS (
        SELECT 1 FROM ad_poll_votes
          WHERE poll_id    = NEW.poll_id
            AND session_id = NEW.session_id
            AND option_id  != NEW.option_id
      ) THEN
        RAISE EXCEPTION 'Single-choice ad poll: already voted for another option (session)';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
