-- user_post_views 테이블에 view_count 컬럼 추가
-- 열람 횟수에 따라 피드 알고리즘 가중치 적용

-- 1. view_count 컬럼 추가 (기본값 1)
ALTER TABLE user_post_views
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 1;

-- 2. 기존 데이터에 대해 view_count를 1로 설정
UPDATE user_post_views
SET view_count = 1
WHERE view_count IS NULL;

-- 3. NOT NULL 제약 조건 추가
ALTER TABLE user_post_views
ALTER COLUMN view_count SET NOT NULL;

-- 4. 인덱스 추가 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_user_post_views_count
ON user_post_views(user_id, view_count DESC);

COMMENT ON COLUMN user_post_views.view_count IS '게시물 열람 횟수 - 횟수가 많을수록 피드에서 후순위';
