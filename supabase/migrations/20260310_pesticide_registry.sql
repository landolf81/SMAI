-- 참외 등록 농약 정보 테이블
-- 식품안전나라 Open API (I1910) 데이터를 DB에 캐시
-- Edge Function(sync-pesticide-data)으로 주기적 동기화

CREATE TABLE IF NOT EXISTS pesticide_registry (
  id SERIAL PRIMARY KEY,
  pesticide_name TEXT NOT NULL,       -- 농약명 (PRDLST_KOR_NM)
  pesticide_eng TEXT,                 -- 영문명 (PRDLST_ENG_NM)
  brand_name TEXT,                    -- 상표명 (BRND_NM)
  formulation TEXT,                   -- 제제형태 (MDC_SHAP_NM)
  purpose TEXT,                       -- 용도 (PRPOS_DVS_CD_NM: 살균제/살충제 등)
  pest_disease TEXT,                  -- 병해충명 (SICKNS_HLSCT_NM_WEEDS_NM)
  crop_name TEXT NOT NULL,            -- 작물명 (CROPS_NM)
  usage_method TEXT,                  -- 사용방법 (AGCHM_USE_MTHD)
  usage_timing TEXT,                  -- 사용적기 (USE_PPRTM)
  dilution TEXT,                      -- 희석배수 (DILU_DRNG)
  usage_count TEXT,                   -- 사용횟수 (USE_TMNO)
  company TEXT,                       -- 회사명 (CPR_NM)
  toxicity TEXT,                      -- 독성 (PERSN_LVSTCK_TOXCTY)
  eco_toxicity TEXT,                  -- 생태독성 (ECLGY_TOXCTY)
  reg_status TEXT,                    -- 등록여부 (REG_YN_NM)
  reg_date TEXT,                      -- 등록일자 (PRDLST_REG_DT)
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: 누구나 조회 가능
ALTER TABLE pesticide_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "누구나 조회 가능"
  ON pesticide_registry FOR SELECT
  USING (true);

-- 검색용 인덱스
CREATE INDEX idx_pesticide_crop ON pesticide_registry (crop_name);
CREATE INDEX idx_pesticide_pest ON pesticide_registry (pest_disease);
CREATE INDEX idx_pesticide_name ON pesticide_registry (pesticide_name);
CREATE INDEX idx_pesticide_brand ON pesticide_registry (brand_name);
CREATE INDEX idx_pesticide_purpose ON pesticide_registry (purpose);
