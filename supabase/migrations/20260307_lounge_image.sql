-- 광장 메시지에 이미지 첨부 기능 추가
ALTER TABLE lounge_messages ADD COLUMN image_url TEXT DEFAULT NULL;

-- content 제약 조건 수정: 텍스트 또는 이미지 중 하나는 있어야 함
ALTER TABLE lounge_messages DROP CONSTRAINT IF EXISTS lounge_messages_content_check;
ALTER TABLE lounge_messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE lounge_messages ADD CONSTRAINT lounge_messages_content_or_image
  CHECK (content IS NOT NULL AND char_length(content) > 0 OR image_url IS NOT NULL);
