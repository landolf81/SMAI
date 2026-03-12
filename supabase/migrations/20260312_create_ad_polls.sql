-- ============================================================
-- 광고 투표(Ad Poll) 기능 마이그레이션
-- 테이블: ad_polls, ad_poll_options, ad_poll_votes
-- 트리거: 투표수 자동 갱신, 단일선택 제약
-- RLS: 생성/수정은 관리자만, 투표는 인증된 사용자
-- ============================================================

-- 1) 투표 메타데이터 (광고에 귀속)
CREATE TABLE IF NOT EXISTS ad_polls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id       UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  question    TEXT NOT NULL CHECK (char_length(question) <= 100),
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  is_multiple  BOOLEAN NOT NULL DEFAULT false,
  expires_at   TIMESTAMPTZ,
  is_closed    BOOLEAN NOT NULL DEFAULT false,
  total_votes  INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_polls_ad      ON ad_polls(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_polls_created ON ad_polls(created_at DESC);

-- 2) 투표 선택지
CREATE TABLE IF NOT EXISTS ad_poll_options (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID NOT NULL REFERENCES ad_polls(id) ON DELETE CASCADE,
  label      TEXT NOT NULL CHECK (char_length(label) <= 50),
  sort_order INT NOT NULL DEFAULT 0,
  vote_count INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ad_poll_options_poll ON ad_poll_options(poll_id);

-- 3) 개별 투표 기록
CREATE TABLE IF NOT EXISTS ad_poll_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID NOT NULL REFERENCES ad_polls(id) ON DELETE CASCADE,
  option_id  UUID NOT NULL REFERENCES ad_poll_options(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, option_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_poll_votes_poll   ON ad_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_ad_poll_votes_user   ON ad_poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_poll_votes_option ON ad_poll_votes(option_id);

-- 4) ads 테이블에 poll_id 컬럼 추가
ALTER TABLE ads
  ADD COLUMN IF NOT EXISTS poll_id UUID REFERENCES ad_polls(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ads_poll
  ON ads(poll_id) WHERE poll_id IS NOT NULL;

-- ============================================================
-- 트리거 1: 투표 삽입/삭제 시 vote_count, total_votes 자동 갱신
-- ============================================================
CREATE OR REPLACE FUNCTION update_ad_poll_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE ad_poll_options
      SET vote_count = vote_count + 1
      WHERE id = NEW.option_id;
    UPDATE ad_polls
      SET total_votes = total_votes + 1
      WHERE id = NEW.poll_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE ad_poll_options
      SET vote_count = GREATEST(vote_count - 1, 0)
      WHERE id = OLD.option_id;
    UPDATE ad_polls
      SET total_votes = GREATEST(total_votes - 1, 0)
      WHERE id = OLD.poll_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ad_poll_vote_counts ON ad_poll_votes;
CREATE TRIGGER trg_ad_poll_vote_counts
  AFTER INSERT OR DELETE ON ad_poll_votes
  FOR EACH ROW EXECUTE FUNCTION update_ad_poll_vote_counts();

-- ============================================================
-- 트리거 2: 단일선택 투표 제약 (is_multiple=false일 때)
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_single_choice_ad_poll()
RETURNS TRIGGER AS $$
DECLARE
  v_is_multiple BOOLEAN;
BEGIN
  SELECT is_multiple INTO v_is_multiple
    FROM ad_polls WHERE id = NEW.poll_id;

  IF NOT v_is_multiple THEN
    IF EXISTS (
      SELECT 1 FROM ad_poll_votes
        WHERE poll_id  = NEW.poll_id
          AND user_id  = NEW.user_id
          AND option_id != NEW.option_id
    ) THEN
      RAISE EXCEPTION 'Single-choice ad poll: already voted for another option';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_single_choice_ad ON ad_poll_votes;
CREATE TRIGGER trg_enforce_single_choice_ad
  BEFORE INSERT ON ad_poll_votes
  FOR EACH ROW EXECUTE FUNCTION enforce_single_choice_ad_poll();

-- ============================================================
-- RLS 정책
-- ============================================================

-- ad_polls: 조회 공개, 생성/수정 관리자만
ALTER TABLE ad_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_polls_select" ON ad_polls FOR SELECT USING (true);
CREATE POLICY "ad_polls_insert" ON ad_polls FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));
CREATE POLICY "ad_polls_update" ON ad_polls FOR UPDATE
  USING (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));
CREATE POLICY "ad_polls_delete" ON ad_polls FOR DELETE
  USING (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));

-- ad_poll_options: 조회 공개, 생성/삭제 관리자만
ALTER TABLE ad_poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_poll_options_select" ON ad_poll_options FOR SELECT USING (true);
CREATE POLICY "ad_poll_options_insert" ON ad_poll_options FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));
CREATE POLICY "ad_poll_options_delete" ON ad_poll_options FOR DELETE
  USING (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));

-- ad_poll_votes: 조회 공개, 투표 삽입/취소 본인만
ALTER TABLE ad_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_poll_votes_select" ON ad_poll_votes FOR SELECT USING (true);
CREATE POLICY "ad_poll_votes_insert" ON ad_poll_votes FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "ad_poll_votes_delete" ON ad_poll_votes FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- Realtime: 투표 변경 실시간 감지용
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE ad_poll_votes;
