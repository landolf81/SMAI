# 참외 농약정보 검색 기능 (식품안전나라 API 연동)

## Context
- 식품안전나라 Open API (I1910) 키 승인 완료: `c7d2b23da4d34c7598a3`
- 전체 54,836건 중 참외 데이터 추출하여 Supabase DB에 저장
- 기존 `PesticideInfo.jsx` 플레이스홀더 → 실제 검색 UI로 교체
- QnA 탭의 '농약정보' 탭에서 접근 (이미 라우팅 완료)

## 구현 계획

### 1. DB 마이그레이션
**파일**: `supabase/migrations/20260310_pesticide_registry.sql`

```sql
CREATE TABLE pesticide_registry (
  id SERIAL PRIMARY KEY,
  pesticide_name TEXT NOT NULL,       -- PRDLST_KOR_NM (농약명)
  pesticide_eng TEXT,                 -- PRDLST_ENG_NM (영문명)
  brand_name TEXT,                    -- BRND_NM (상표명)
  formulation TEXT,                   -- MDC_SHAP_NM (제제형태)
  purpose TEXT,                       -- PRPOS_DVS_CD_NM (용도: 살균제/살충제)
  pest_disease TEXT,                  -- SICKNS_HLSCT_NM_WEEDS_NM (병해충명)
  crop_name TEXT NOT NULL,            -- CROPS_NM (작물명 = '참외')
  usage_method TEXT,                  -- AGCHM_USE_MTHD (사용방법)
  usage_timing TEXT,                  -- USE_PPRTM (사용적기)
  dilution TEXT,                      -- DILU_DRNG (희석배수)
  usage_count TEXT,                   -- USE_TMNO (사용횟수)
  company TEXT,                       -- CPR_NM (회사명)
  toxicity TEXT,                      -- PERSN_LVSTCK_TOXCTY (독성)
  eco_toxicity TEXT,                  -- ECLGY_TOXCTY (생태독성)
  reg_status TEXT,                    -- REG_YN_NM (등록여부)
  reg_date TEXT,                      -- PRDLST_REG_DT (등록일자)
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: 누구나 조회 가능
ALTER TABLE pesticide_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "누구나 조회" ON pesticide_registry FOR SELECT USING (true);

-- 검색용 인덱스
CREATE INDEX idx_pesticide_crop ON pesticide_registry (crop_name);
CREATE INDEX idx_pesticide_pest ON pesticide_registry (pest_disease);
CREATE INDEX idx_pesticide_name ON pesticide_registry (pesticide_name);
CREATE INDEX idx_pesticide_brand ON pesticide_registry (brand_name);
```

### 2. Edge Function - 데이터 동기화
**파일**: `supabase/functions/sync-pesticide-data/index.ts`

- 식품안전나라 API에서 전체 데이터 페이징 조회 (1000건씩)
- `CROPS_NM`에 '참외' 포함된 데이터만 필터
- 기존 데이터 DELETE → INSERT (전체 교체 방식)
- 수동 호출 또는 월 1회 cron 등록
- API URL: `http://openapi.foodsafetykorea.go.kr/api/{key}/I1910/json/{start}/{end}`

### 3. pesticideService.js 생성
**파일**: `src/services/pesticideService.js`

```javascript
export const pesticideService = {
  // 전체 참외 농약 목록 (병해충별 그룹)
  getAll() → pesticide_registry에서 crop_name='참외' 전체 조회

  // 검색 (농약명/상표명/병해충명)
  search(keyword) → ilike 검색

  // 병해충별 필터
  getByPestDisease(name) → pest_disease 필터

  // 용도별 필터 (살균제/살충제)
  getByPurpose(purpose) → purpose 필터
};
```

**`src/services/index.js`에 export 추가**

### 4. PesticideInfo.jsx 리팩토링
**파일**: `src/components/PesticideInfo.jsx`

현재 플레이스홀더 → 실제 검색 UI로 교체:

- **상단**: 검색바 (농약명/상표명/병해충명 통합 검색)
- **필터 칩**: 용도별 (전체/살균제/살충제/살충살균제), 병해충별 필터
- **결과 카드**: 아코디언 형태
  - 접힌 상태: 상표명 + 병해충 + 용도 뱃지
  - 펼친 상태: 희석배수, 사용시기, 사용횟수, 독성, 회사명 등 전체 정보
- **빈 상태**: 검색 결과 없음 안내
- 기존 PestDiseaseInfo.jsx의 카드 스타일과 유사하게 디자인

## 구현 순서
1. DB 마이그레이션 SQL 작성
2. Edge Function 작성 (데이터 동기화)
3. pesticideService.js 생성 + index.js export
4. PesticideInfo.jsx UI 구현

## 검증
- Edge Function 실행하여 참외 데이터 동기화 확인
- 농약정보 탭에서 검색/필터 동작 확인
- 병해충별 필터와 PestDiseaseInfo와 연계 가능성 확인
