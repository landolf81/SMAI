-- market_favorites 테이블 user_id를 integer → UUID로 변경
-- 기존 데이터가 있으면 삭제 후 컬럼 변경 (integer 데이터는 UUID로 변환 불가)
-- =============================================

-- 1. 기존 데이터 삭제 (integer → UUID 직접 캐스팅 불가)
DELETE FROM market_favorites;

-- 2. 기존 integer 컬럼 삭제 후 UUID로 재생성
ALTER TABLE market_favorites DROP COLUMN user_id;
ALTER TABLE market_favorites ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. sort_order 컬럼 추가 (순서 저장용)
ALTER TABLE market_favorites ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 4. 기존 RLS 정책 삭제 후 재생성 (user_id = auth.uid() 매칭)
DROP POLICY IF EXISTS "market_favorites_select_authenticated" ON market_favorites;
DROP POLICY IF EXISTS "market_favorites_insert_authenticated" ON market_favorites;
DROP POLICY IF EXISTS "market_favorites_delete_authenticated" ON market_favorites;
DROP POLICY IF EXISTS "market_favorites_update_authenticated" ON market_favorites;

-- SELECT: 본인 것만 조회
CREATE POLICY "market_favorites_select_own" ON market_favorites
  FOR SELECT USING ((select auth.uid()) = user_id);

-- INSERT: 본인 것만 추가
CREATE POLICY "market_favorites_insert_own" ON market_favorites
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- UPDATE: 본인 것만 수정 (is_active 토글용)
CREATE POLICY "market_favorites_update_own" ON market_favorites
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- DELETE: 본인 것만 삭제
CREATE POLICY "market_favorites_delete_own" ON market_favorites
  FOR DELETE USING ((select auth.uid()) = user_id);
