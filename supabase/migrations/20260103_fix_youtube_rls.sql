-- YouTube RLS 정책 수정
-- admin_roles 테이블을 참조하도록 변경

-- 기존 정책 삭제 (존재하는 경우)
DROP POLICY IF EXISTS "Admin can manage channels" ON youtube_channels;
DROP POLICY IF EXISTS "Admin can read all videos" ON youtube_videos;
DROP POLICY IF EXISTS "Admin can manage videos" ON youtube_videos;

-- 새 정책 생성 (admin_roles 테이블 참조)
CREATE POLICY "Admin can manage channels" ON youtube_channels FOR ALL USING (
  EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'content_admin'))
);

CREATE POLICY "Admin can read all videos" ON youtube_videos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'content_admin'))
  );

CREATE POLICY "Admin can manage videos" ON youtube_videos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'content_admin'))
  );
