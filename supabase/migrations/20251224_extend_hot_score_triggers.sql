-- =============================================
-- hot_score 트리거 확장
-- 생성일: 2025-12-24
-- 설명: likes/comments 변경 시에도 hot_score 재계산
-- 문제: views_count 변경 시에만 hot_score가 갱신되어 시간 경과가 반영되지 않음
-- =============================================

-- =============================================
-- 1. likes_count 업데이트 트리거 수정 (hot_score 포함)
-- =============================================
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
DECLARE
  v_post RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 현재 게시물 정보 조회
    SELECT likes_count, comments_count, views_count, created_at
    INTO v_post
    FROM public.posts
    WHERE id = NEW.post_id;

    -- likes_count와 hot_score 동시 업데이트
    UPDATE public.posts
    SET
      likes_count = COALESCE(v_post.likes_count, 0) + 1,
      hot_score = public.calculate_hot_score(
        COALESCE(v_post.likes_count, 0) + 1,
        COALESCE(v_post.comments_count, 0),
        COALESCE(v_post.views_count, 0),
        v_post.created_at
      )
    WHERE id = NEW.post_id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- 현재 게시물 정보 조회
    SELECT likes_count, comments_count, views_count, created_at
    INTO v_post
    FROM public.posts
    WHERE id = OLD.post_id;

    -- likes_count와 hot_score 동시 업데이트
    UPDATE public.posts
    SET
      likes_count = GREATEST(COALESCE(v_post.likes_count, 0) - 1, 0),
      hot_score = public.calculate_hot_score(
        GREATEST(COALESCE(v_post.likes_count, 0) - 1, 0),
        COALESCE(v_post.comments_count, 0),
        COALESCE(v_post.views_count, 0),
        v_post.created_at
      )
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS trigger_update_post_likes_count ON public.likes;

CREATE TRIGGER trigger_update_post_likes_count
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION update_post_likes_count();

-- =============================================
-- 2. comments_count 업데이트 트리거 함수 (hot_score 포함)
-- =============================================
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
DECLARE
  v_post RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 현재 게시물 정보 조회
    SELECT likes_count, comments_count, views_count, created_at
    INTO v_post
    FROM public.posts
    WHERE id = NEW.post_id;

    -- comments_count와 hot_score 동시 업데이트
    UPDATE public.posts
    SET
      comments_count = COALESCE(v_post.comments_count, 0) + 1,
      hot_score = public.calculate_hot_score(
        COALESCE(v_post.likes_count, 0),
        COALESCE(v_post.comments_count, 0) + 1,
        COALESCE(v_post.views_count, 0),
        v_post.created_at
      )
    WHERE id = NEW.post_id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- 현재 게시물 정보 조회
    SELECT likes_count, comments_count, views_count, created_at
    INTO v_post
    FROM public.posts
    WHERE id = OLD.post_id;

    -- comments_count와 hot_score 동시 업데이트
    UPDATE public.posts
    SET
      comments_count = GREATEST(COALESCE(v_post.comments_count, 0) - 1, 0),
      hot_score = public.calculate_hot_score(
        COALESCE(v_post.likes_count, 0),
        GREATEST(COALESCE(v_post.comments_count, 0) - 1, 0),
        COALESCE(v_post.views_count, 0),
        v_post.created_at
      )
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS trigger_update_post_comments_count ON public.comments;

CREATE TRIGGER trigger_update_post_comments_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_comments_count();

-- =============================================
-- 3. 기존 게시물 hot_score 일괄 갱신
-- 마이그레이션 실행 시 모든 게시물의 hot_score를 현재 시점 기준으로 재계산
-- =============================================
UPDATE public.posts
SET hot_score = public.calculate_hot_score(
  COALESCE(likes_count, 0),
  COALESCE(comments_count, 0),
  COALESCE(views_count, 0),
  created_at
)
WHERE post_type IN ('general', 'qna', 'secondhand');

-- =============================================
-- 4. pg_cron 활성화 및 일일 자동 갱신 스케줄 설정
-- =============================================

-- pg_cron 확장 활성화 (이미 활성화되어 있으면 무시됨)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 기존 스케줄 삭제 (있는 경우)
SELECT cron.unschedule('refresh-hot-scores')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-hot-scores'
);

-- 매일 새벽 4시(KST 기준, UTC 19:00)에 hot_score 일괄 갱신
-- 한국 시간 04:00 = UTC 19:00 (전날)
SELECT cron.schedule(
  'refresh-hot-scores',
  '0 19 * * *',
  $$
    UPDATE public.posts
    SET hot_score = public.calculate_hot_score(
      COALESCE(likes_count, 0),
      COALESCE(comments_count, 0),
      COALESCE(views_count, 0),
      created_at
    )
    WHERE post_type IN ('general', 'qna', 'secondhand');
  $$
);

-- =============================================
-- 완료
-- =============================================
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- 실행 후:
-- 1. 170번 게시물 등 오래된 게시물의 hot_score가 즉시 정상화됩니다
-- 2. 매일 새벽 4시(KST)에 모든 게시물의 hot_score가 자동 갱신됩니다
-- 3. 좋아요/댓글/조회수 변경 시에도 즉시 갱신됩니다
