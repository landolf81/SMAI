-- 광장 다중 이미지 지원을 위한 image_urls 배열 컬럼 추가
-- 작성일: 2026-03-15

ALTER TABLE lounge_messages ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT NULL;

-- content 제약 조건 수정: 텍스트, 단일 이미지, 다중 이미지, 또는 투표 중 하나는 있어야 함
ALTER TABLE lounge_messages DROP CONSTRAINT IF EXISTS lounge_messages_content_or_image;
ALTER TABLE lounge_messages ADD CONSTRAINT lounge_messages_content_or_media
  CHECK (
    (content IS NOT NULL AND char_length(content) > 0)
    OR image_url IS NOT NULL
    OR (image_urls IS NOT NULL AND array_length(image_urls, 1) > 0)
    OR poll_id IS NOT NULL
  );
