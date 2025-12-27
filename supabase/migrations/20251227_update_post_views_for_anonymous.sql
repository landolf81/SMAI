-- =============================================
-- post_views 테이블 비로그인 사용자 지원
-- 생성일: 2025-12-27
-- =============================================

-- 기존 unique 제약조건 삭제 (user_id, post_id)
ALTER TABLE public.post_views DROP CONSTRAINT IF EXISTS post_views_user_id_post_id_key;
ALTER TABLE public.post_views DROP CONSTRAINT IF EXISTS post_views_pkey;

-- session_id 컬럼 추가 (없으면)
ALTER TABLE public.post_views ADD COLUMN IF NOT EXISTS session_id TEXT;

-- user_id를 nullable로 변경 (비로그인 사용자용)
ALTER TABLE public.post_views ALTER COLUMN user_id DROP NOT NULL;

-- 기존 중복 데이터 정리 (가장 최근 조회만 유지)
DELETE FROM public.post_views
WHERE ctid NOT IN (
  SELECT MAX(ctid)
  FROM public.post_views
  WHERE user_id IS NOT NULL
  GROUP BY user_id, post_id
)
AND user_id IS NOT NULL;

-- 새 unique 제약조건: 로그인 사용자는 user_id+post_id, 비로그인은 session_id+post_id
-- 복합 unique index 생성
DROP INDEX IF EXISTS post_views_user_post_unique;
DROP INDEX IF EXISTS post_views_session_post_unique;

CREATE UNIQUE INDEX post_views_user_post_unique
ON public.post_views (user_id, post_id)
WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX post_views_session_post_unique
ON public.post_views (session_id, post_id)
WHERE session_id IS NOT NULL;

-- id 컬럼이 없으면 추가하고 primary key로 설정
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_views' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.post_views ADD COLUMN id BIGSERIAL PRIMARY KEY;
  END IF;
END $$;

-- RLS 정책: 비로그인 사용자도 insert 허용
DROP POLICY IF EXISTS "Anyone can insert post_views" ON public.post_views;
CREATE POLICY "Anyone can insert post_views" ON public.post_views
  FOR INSERT WITH CHECK (true);

-- 조회수 통계용 인덱스
CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON public.post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_viewed_at ON public.post_views(viewed_at);
