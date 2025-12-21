-- =============================================
-- 트리거 함수 search_path 수정
-- 생성일: 2025-12-21
-- 설명: "relation posts does not exist" 에러 수정
-- =============================================

-- =============================================
-- 1. calculate_hot_score 함수 수정
-- =============================================
DROP FUNCTION IF EXISTS calculate_hot_score(INTEGER, INTEGER, INTEGER, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION calculate_hot_score(
  p_likes INTEGER,
  p_comments INTEGER,
  p_views INTEGER,
  p_created_at TIMESTAMPTZ
)
RETURNS NUMERIC AS $$
DECLARE
  age_hours NUMERIC;
  score NUMERIC;
BEGIN
  age_hours := EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 3600;
  score := (COALESCE(p_likes, 0) * 3 + COALESCE(p_comments, 0) * 2 + COALESCE(p_views, 0) * 0.1)
           / POWER(age_hours + 2, 1.5);
  RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = '';

-- =============================================
-- 2. likes_count 업데이트 트리거 함수
-- =============================================
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET likes_count = COALESCE(likes_count, 0) + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0)
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
-- 3. on_views_count_update 트리거 함수 (hot_score 업데이트)
-- =============================================
CREATE OR REPLACE FUNCTION on_views_count_update()
RETURNS TRIGGER AS $$
BEGIN
  -- views_count가 변경되었을 때만 hot_score 업데이트
  IF OLD.views_count IS DISTINCT FROM NEW.views_count THEN
    NEW.hot_score := public.calculate_hot_score(
      NEW.likes_count,
      NEW.comments_count,
      NEW.views_count,
      NEW.created_at
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS trigger_views_hot_score ON public.posts;

CREATE TRIGGER trigger_views_hot_score
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION on_views_count_update();

-- =============================================
-- 4. user_post_views upsert 함수
-- =============================================
CREATE OR REPLACE FUNCTION upsert_user_post_view(
  p_user_id UUID,
  p_post_id BIGINT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_post_views (user_id, post_id, view_count, viewed_at)
  VALUES (p_user_id, p_post_id, 1, NOW())
  ON CONFLICT (user_id, post_id)
  DO UPDATE SET
    view_count = public.user_post_views.view_count + 1,
    viewed_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- =============================================
-- 5. increment_post_views 함수 (조회수 증가)
-- =============================================
DROP FUNCTION IF EXISTS increment_post_views(BIGINT);

CREATE OR REPLACE FUNCTION increment_post_views(p_post_id BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.posts
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- =============================================
-- 완료
-- =============================================
-- Supabase Dashboard > SQL Editor에서 실행하세요
