-- =============================================
-- messages 테이블 RLS 정책 재설계
-- 생성일: 2026-03-01
-- 배경: 기존 정책이 conversation_participants 기반으로 설계되어 있었으나
--       실제 서비스(dmService.js)는 conversation_id 없이
--       sender_id / receiver_id 직접 참조 방식으로 동작하여 INSERT 403 발생
-- 해결: sender_id / receiver_id 기반 정책으로 교체
-- =============================================

-- 기존 정책 제거
DROP POLICY IF EXISTS "messages_select_participant"  ON messages;
DROP POLICY IF EXISTS "messages_insert_participant"  ON messages;
DROP POLICY IF EXISTS "messages_select_own"          ON messages;
DROP POLICY IF EXISTS "messages_insert_own"          ON messages;
DROP POLICY IF EXISTS "messages_update_own"          ON messages;
DROP POLICY IF EXISTS "messages_delete_own"          ON messages;

-- RLS 활성화 (이미 활성화되어 있어도 안전)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- SELECT: 내가 보냈거나 받은 메시지만 조회 가능
CREATE POLICY "messages_select_own" ON messages
  FOR SELECT USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  );

-- INSERT: sender_id 가 본인인 메시지만 전송 가능
CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
  );

-- UPDATE: 내가 받은 메시지(읽음 처리) 또는 내가 보낸 메시지 수정 가능
CREATE POLICY "messages_update_own" ON messages
  FOR UPDATE USING (
    receiver_id = auth.uid() OR sender_id = auth.uid()
  );

-- DELETE: 내가 보낸 메시지만 삭제 가능
CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE USING (
    sender_id = auth.uid()
  );

-- =============================================
-- 완료: Supabase Dashboard > SQL Editor에서 실행
-- =============================================
