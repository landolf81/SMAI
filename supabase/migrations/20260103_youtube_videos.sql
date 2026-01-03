-- YouTube 채널 테이블
CREATE TABLE youtube_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT NOT NULL UNIQUE,           -- YouTube 채널 ID (UC...)
  channel_name TEXT NOT NULL,                -- 채널명
  channel_handle TEXT,                       -- @핸들
  is_active BOOLEAN DEFAULT true,            -- 활성화 여부
  filter_keywords TEXT[],                    -- 필터링 키워드 (null이면 모든 영상)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- YouTube 동영상 테이블
CREATE TABLE youtube_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL UNIQUE,             -- YouTube 비디오 ID
  channel_id TEXT NOT NULL,                  -- YouTube 채널 ID
  title TEXT NOT NULL,                       -- 영상 제목
  description TEXT,                          -- 영상 설명
  thumbnail_url TEXT,                        -- 썸네일 URL
  published_at TIMESTAMPTZ,                  -- 원본 업로드 시간
  duration TEXT,                             -- 영상 길이
  view_count INTEGER,                        -- 조회수

  -- 수집 정보
  source TEXT NOT NULL DEFAULT 'rss',        -- 수집 소스: 'rss', 'search'
  collected_at TIMESTAMPTZ DEFAULT NOW(),    -- 수집 시간

  -- 승인 정보
  status TEXT NOT NULL DEFAULT 'pending',    -- pending, approved, rejected
  reviewed_by UUID REFERENCES users(id),     -- 승인/거절한 관리자
  reviewed_at TIMESTAMPTZ,                   -- 승인/거절 시간
  reject_reason TEXT,                        -- 거절 사유

  -- 피드 게시 정보
  posted_at TIMESTAMPTZ,                     -- 피드에 게시된 시간

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_youtube_videos_status ON youtube_videos(status);
CREATE INDEX idx_youtube_videos_channel ON youtube_videos(channel_id);
CREATE INDEX idx_youtube_videos_posted ON youtube_videos(posted_at DESC) WHERE status = 'approved';
CREATE INDEX idx_youtube_channels_active ON youtube_channels(is_active) WHERE is_active = true;

-- RLS 정책
ALTER TABLE youtube_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;

-- 채널: 누구나 읽기, 관리자만 수정
CREATE POLICY "Anyone can read channels" ON youtube_channels FOR SELECT USING (true);
CREATE POLICY "Admin can manage channels" ON youtube_channels FOR ALL USING (
  EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'content_admin'))
);

-- 동영상: 승인된 것만 읽기, 관리자는 모두 읽기/수정
CREATE POLICY "Anyone can read approved videos" ON youtube_videos
  FOR SELECT USING (status = 'approved');
CREATE POLICY "Admin can read all videos" ON youtube_videos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'content_admin'))
  );
CREATE POLICY "Admin can manage videos" ON youtube_videos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'content_admin'))
  );

-- 초기 채널 추가: farmlab_gitta
INSERT INTO youtube_channels (channel_id, channel_name, channel_handle, filter_keywords)
VALUES (
  'UCyzQwr8WBV40p80kp1yDPjA',
  '팜랩기타',
  '@farmlab_gitta',
  ARRAY['참외', '멜론', '박과', '하우스', '농사', '재배', '병해', '수확']
);

-- Updated_at 트리거
CREATE OR REPLACE FUNCTION update_youtube_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER youtube_channels_updated_at
  BEFORE UPDATE ON youtube_channels
  FOR EACH ROW EXECUTE FUNCTION update_youtube_updated_at();

CREATE TRIGGER youtube_videos_updated_at
  BEFORE UPDATE ON youtube_videos
  FOR EACH ROW EXECUTE FUNCTION update_youtube_updated_at();
