-- 농약 등록 정보 중 완전히 동일한 행 중복 제거
-- 모든 주요 컬럼이 같은 경우 id가 가장 작은 행만 유지
DELETE FROM pesticide_registry
WHERE id NOT IN (
  SELECT MIN(id)
  FROM pesticide_registry
  GROUP BY
    pesticide_name,
    pesticide_eng,
    brand_name,
    formulation,
    purpose,
    pest_disease,
    crop_name,
    usage_method,
    usage_timing,
    dilution,
    usage_count,
    company,
    toxicity,
    eco_toxicity,
    reg_status,
    reg_date
);
