/**
 * sync-pesticide-data Edge Function
 * 식품안전나라 Open API(I1910)에서 참외 등록 농약 데이터를 수집하여 DB에 저장
 * 수동 호출 또는 월 1회 cron으로 실행
 *
 * 흐름:
 *   1. API를 1000건씩 페이징 조회 (전체 ~55,000건)
 *   2. CROPS_NM에 '참외' 포함된 데이터만 필터
 *   3. 기존 데이터 삭제 후 새 데이터 일괄 삽입
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// ── 환경 변수 ──
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FOOD_SAFETY_API_KEY = Deno.env.get('FOOD_SAFETY_API_KEY')!

// ── 상수 ──
const API_BASE = 'http://openapi.foodsafetykorea.go.kr/api'
const SERVICE_ID = 'I1910'
const PAGE_SIZE = 1000
const CROP_KEYWORD = '참외'

// ── 유틸 ──
function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── API 타입 ──
interface ApiRow {
  PRDLST_KOR_NM: string
  PRDLST_ENG_NM: string
  BRND_NM: string
  MDC_SHAP_NM: string
  PRPOS_DVS_CD_NM: string
  SICKNS_HLSCT_NM_WEEDS_NM: string
  CROPS_NM: string
  AGCHM_USE_MTHD: string
  USE_PPRTM: string
  DILU_DRNG: string
  USE_TMNO: string
  CPR_NM: string
  PERSN_LVSTCK_TOXCTY: string
  ECLGY_TOXCTY: string
  REG_YN_NM: string
  PRDLST_REG_DT: string
  USE_QTY: string
  USE_UNIT: string
}

interface DbRow {
  pesticide_name: string
  pesticide_eng: string
  brand_name: string
  formulation: string
  purpose: string
  pest_disease: string
  crop_name: string
  usage_method: string
  usage_timing: string
  dilution: string
  usage_count: string
  company: string
  toxicity: string
  eco_toxicity: string
  reg_status: string
  reg_date: string
}

/** API 행 → DB 행 변환 */
function toDbRow(row: ApiRow): DbRow {
  return {
    pesticide_name: row.PRDLST_KOR_NM || '',
    pesticide_eng: row.PRDLST_ENG_NM || '',
    brand_name: row.BRND_NM || '',
    formulation: row.MDC_SHAP_NM || '',
    purpose: row.PRPOS_DVS_CD_NM || '',
    pest_disease: row.SICKNS_HLSCT_NM_WEEDS_NM || '',
    crop_name: row.CROPS_NM || '',
    usage_method: row.AGCHM_USE_MTHD || '',
    usage_timing: row.USE_PPRTM || '',
    dilution: row.DILU_DRNG || '',
    usage_count: row.USE_TMNO || '',
    company: row.CPR_NM || '',
    toxicity: row.PERSN_LVSTCK_TOXCTY || '',
    eco_toxicity: row.ECLGY_TOXCTY || '',
    reg_status: row.REG_YN_NM || '',
    reg_date: row.PRDLST_REG_DT || '',
  }
}

/** 전체 데이터에서 참외 행만 추출 (페이징 순회) */
async function fetchAllChamoeRows(): Promise<DbRow[]> {
  const chamoeRows: DbRow[] = []
  let startIdx = 1
  let totalCount = 0
  let fetched = 0

  // 먼저 총 건수 파악
  const firstUrl = `${API_BASE}/${FOOD_SAFETY_API_KEY}/${SERVICE_ID}/json/1/1`
  const firstRes = await fetch(firstUrl)
  const firstData = await firstRes.json()
  totalCount = parseInt(firstData[SERVICE_ID]?.total_count || '0', 10)
  console.log(`[sync-pesticide] 전체 데이터: ${totalCount}건`)

  if (totalCount === 0) return chamoeRows

  // 페이징 순회
  while (startIdx <= totalCount) {
    const endIdx = Math.min(startIdx + PAGE_SIZE - 1, totalCount)
    const url = `${API_BASE}/${FOOD_SAFETY_API_KEY}/${SERVICE_ID}/json/${startIdx}/${endIdx}`

    try {
      const res = await fetch(url)
      const data = await res.json()
      const rows: ApiRow[] = data[SERVICE_ID]?.row || []

      for (const row of rows) {
        if (row.CROPS_NM && row.CROPS_NM.includes(CROP_KEYWORD)) {
          chamoeRows.push(toDbRow(row))
        }
      }

      fetched += rows.length
      console.log(`[sync-pesticide] ${startIdx}~${endIdx} 조회 (참외 누적: ${chamoeRows.length}건)`)
    } catch (err) {
      console.error(`[sync-pesticide] 페이지 ${startIdx}~${endIdx} 오류:`, err)
    }

    startIdx += PAGE_SIZE

    // API 부하 방지 (100ms 대기)
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`[sync-pesticide] 완료: 전체 ${fetched}건 중 참외 ${chamoeRows.length}건`)

  // 완전히 동일한 행 중복 제거
  const seen = new Set<string>()
  const uniqueRows = chamoeRows.filter(row => {
    const key = JSON.stringify(row)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  console.log(`[sync-pesticide] 중복 제거: ${chamoeRows.length}건 → ${uniqueRows.length}건 (${chamoeRows.length - uniqueRows.length}건 제거)`)

  return uniqueRows
}

// ── 메인 핸들러 ──
Deno.serve(async (_req: Request) => {
  try {
    console.log('[sync-pesticide] 동기화 시작')

    // 1. API에서 참외 데이터 수집
    const chamoeRows = await fetchAllChamoeRows()

    if (chamoeRows.length === 0) {
      return jsonRes({ success: false, message: '참외 데이터 없음' })
    }

    // 2. Supabase에 저장 (기존 데이터 삭제 → 새 데이터 삽입)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 기존 참외 데이터 삭제
    const { error: deleteError } = await supabase
      .from('pesticide_registry')
      .delete()
      .eq('crop_name', CROP_KEYWORD)

    if (deleteError) {
      console.error('[sync-pesticide] 삭제 오류:', deleteError)
      return jsonRes({ success: false, error: deleteError.message }, 500)
    }

    // 100건씩 배치 삽입 (Supabase 제한 고려)
    const BATCH_SIZE = 100
    let inserted = 0

    for (let i = 0; i < chamoeRows.length; i += BATCH_SIZE) {
      const batch = chamoeRows.slice(i, i + BATCH_SIZE)
      const { error: insertError } = await supabase
        .from('pesticide_registry')
        .insert(batch)

      if (insertError) {
        console.error(`[sync-pesticide] 배치 ${i} 삽입 오류:`, insertError)
      } else {
        inserted += batch.length
      }
    }

    console.log(`[sync-pesticide] 동기화 완료: ${inserted}건 저장`)
    return jsonRes({
      success: true,
      total_api: chamoeRows.length,
      inserted,
    })
  } catch (err) {
    console.error('[sync-pesticide] 오류:', err)
    return jsonRes({ success: false, error: String(err) }, 500)
  }
})
