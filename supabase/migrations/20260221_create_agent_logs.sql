-- OpenClaw 에이전트 요청/응답 기록 테이블
-- 역할: hooks/agent로 전송한 메시지와 에이전트 응답을 저장

CREATE TABLE IF NOT EXISTS agent_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        TEXT UNIQUE NOT NULL,           -- OpenClaw runId
  session       TEXT NOT NULL,                  -- OpenClaw 세션 키 (예: seonnam-weather)
  source        TEXT NOT NULL DEFAULT 'seonnam.com', -- 요청 출처
  message       TEXT NOT NULL,                  -- 보낸 메시지
  response      TEXT,                           -- 에이전트 응답 (비동기 수신)
  status        TEXT NOT NULL DEFAULT 'pending' -- pending | done | error
                CHECK (status IN ('pending', 'done', 'error')),
  metadata      JSONB DEFAULT '{}',             -- 추가 메타데이터
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at  TIMESTAMPTZ                     -- 응답 수신 시각
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_logs_run_id     ON agent_logs (run_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_session    ON agent_logs (session, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_status     ON agent_logs (status, created_at DESC);

-- RLS 비활성화 (서버 전용 테이블 - Edge Function이 service role로 접근)
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- 일반 사용자는 읽기 불가 (서버만 접근)
CREATE POLICY "agent_logs_no_public_access" ON agent_logs
  FOR ALL USING (false);

-- 30일 지난 로그 자동 삭제 (선택사항 - pg_cron 필요)
-- SELECT cron.schedule('cleanup-agent-logs', '0 3 * * *',
--   $$DELETE FROM agent_logs WHERE created_at < NOW() - INTERVAL '30 days'$$);
