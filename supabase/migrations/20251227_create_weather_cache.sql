-- 날씨 캐시 테이블
-- 기상청 API 응답을 캐싱하여 빠른 조회 제공

CREATE TABLE IF NOT EXISTS weather_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_key TEXT NOT NULL UNIQUE,  -- 'default' 또는 'nx_ny' 형식
  data JSONB NOT NULL,                -- 전체 날씨 데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_weather_cache_location ON weather_cache(location_key);
CREATE INDEX IF NOT EXISTS idx_weather_cache_updated ON weather_cache(updated_at);

-- RLS 활성화
ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 읽기 허용
CREATE POLICY "weather_cache_read_all" ON weather_cache
  FOR SELECT USING (true);

-- 인증된 사용자만 쓰기 (서버리스 함수용)
CREATE POLICY "weather_cache_write_authenticated" ON weather_cache
  FOR ALL USING (true);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_weather_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weather_cache_updated_at_trigger
  BEFORE UPDATE ON weather_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_weather_cache_updated_at();

-- 코멘트
COMMENT ON TABLE weather_cache IS '기상청 API 날씨 데이터 캐시';
COMMENT ON COLUMN weather_cache.location_key IS '위치 키 (default 또는 nx_ny 형식)';
COMMENT ON COLUMN weather_cache.data IS '날씨 데이터 JSON (current, shortTerm, daily, midTerm)';
