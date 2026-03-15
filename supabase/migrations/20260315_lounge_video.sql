-- 광장 동영상 URL 지원 추가
-- 작성일: 2026-03-15

-- video_url 컬럼 추가
ALTER TABLE lounge_messages ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT NULL;

-- content 제약 조건 수정: 텍스트, 단일 이미지, 다중 이미지, 동영상, 또는 투표 중 하나는 있어야 함
ALTER TABLE lounge_messages DROP CONSTRAINT IF EXISTS lounge_messages_content_or_media;
ALTER TABLE lounge_messages ADD CONSTRAINT lounge_messages_content_or_media
  CHECK (
    (content IS NOT NULL AND char_length(content) > 0)
    OR image_url IS NOT NULL
    OR (image_urls IS NOT NULL AND array_length(image_urls, 1) > 0)
    OR video_url IS NOT NULL
    OR poll_id IS NOT NULL
  );
