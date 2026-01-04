-- =============================================
-- 정책 누락 테이블 RLS 정책 추가
-- 생성일: 2025-12-21
-- 설명: RLS 활성화되었으나 정책이 없는 테이블에 정책 추가
-- =============================================

-- =============================================
-- 1. market_data 테이블 (시장 데이터 - 읽기 전용)
-- =============================================
DROP POLICY IF EXISTS "market_data_select_all" ON market_data;
CREATE POLICY "market_data_select_all" ON market_data
  FOR SELECT USING (true);

-- =============================================
-- 2. market_summary 테이블 (시장 요약 - 읽기 전용)
-- =============================================
DROP POLICY IF EXISTS "market_summary_select_all" ON market_summary;
CREATE POLICY "market_summary_select_all" ON market_summary
  FOR SELECT USING (true);

-- =============================================
-- 3. message_attachments 테이블 (메시지 첨부파일)
-- =============================================
-- 대화 참여자만 접근 가능
DROP POLICY IF EXISTS "message_attachments_participant_only" ON message_attachments;
CREATE POLICY "message_attachments_participant_only" ON message_attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_attachments.message_id
      AND cp.user_id = auth.uid()
    )
  );

-- =============================================
-- 4. messages 테이블 (메시지)
-- =============================================
-- 대화 참여자만 조회 가능
DROP POLICY IF EXISTS "messages_select_participant" ON messages;
CREATE POLICY "messages_select_participant" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
    )
  );

-- 대화 참여자만 메시지 전송 가능
DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
CREATE POLICY "messages_insert_participant" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
    )
  );

-- =============================================
-- 5. post_views 테이블 (게시물 조회수)
-- =============================================
-- 모든 사용자 조회 가능
DROP POLICY IF EXISTS "post_views_select_all" ON post_views;
CREATE POLICY "post_views_select_all" ON post_views
  FOR SELECT USING (true);

-- 인증된 사용자만 조회 기록 추가 가능
DROP POLICY IF EXISTS "post_views_insert_authenticated" ON post_views;
CREATE POLICY "post_views_insert_authenticated" ON post_views
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- 6. translation_history 테이블 (번역 이력)
-- =============================================
-- 본인 번역 이력만 조회 가능
DROP POLICY IF EXISTS "translation_history_select_own" ON translation_history;
CREATE POLICY "translation_history_select_own" ON translation_history
  FOR SELECT USING (auth.uid() = user_id);

-- 본인 번역 이력만 추가 가능
DROP POLICY IF EXISTS "translation_history_insert_own" ON translation_history;
CREATE POLICY "translation_history_insert_own" ON translation_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 7. verification_requests 테이블 (인증 요청)
-- =============================================
-- 본인 인증 요청만 조회 가능
DROP POLICY IF EXISTS "verification_requests_select_own" ON verification_requests;
CREATE POLICY "verification_requests_select_own" ON verification_requests
  FOR SELECT USING (auth.uid() = user_id);

-- 본인 인증 요청만 추가 가능
DROP POLICY IF EXISTS "verification_requests_insert_own" ON verification_requests;
CREATE POLICY "verification_requests_insert_own" ON verification_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 관리자는 모든 인증 요청 조회/수정 가능 (admin_roles 테이블 사용)
DROP POLICY IF EXISTS "verification_requests_admin" ON verification_requests;
CREATE POLICY "verification_requests_admin" ON verification_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.role IN ('super_admin', 'content_admin', 'market_admin')
    )
  );

-- =============================================
-- 8. 광고 추적 RPC 함수 생성
-- =============================================

-- 광고 노출 카운터 증가 함수
CREATE OR REPLACE FUNCTION increment_ad_impressions(ad_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.ads
  SET impressions = COALESCE(impressions, 0) + 1
  WHERE id = ad_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- 광고 클릭 카운터 증가 함수
CREATE OR REPLACE FUNCTION increment_ad_clicks(ad_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.ads
  SET clicks = COALESCE(clicks, 0) + 1
  WHERE id = ad_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- =============================================
-- 완료
-- =============================================
-- 7개 테이블에 정책 추가 + 광고 RPC 함수 2개 생성
