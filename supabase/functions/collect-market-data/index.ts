/**
 * collect-market-data Edge Function
 * 공공데이터포털 API로 농협가락·대전 공판장 참외 경매 데이터 수집
 * pg_cron에서 매일 KST 06:00 (UTC 21:00) 호출
 *
 * 수집 흐름:
 *   1. 전일자(또는 요청 날짜) 기준 두 공판장 참외 데이터 API 조회
 *   2. 등급·무게별로 집계하여 market_data 테이블에 upsert
 *   3. 시장별 요약을 market_summary 테이블에 upsert
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// ── 환경 변수 ──
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DATA_API_KEY = Deno.env.get('DATA_GO_KR_API_KEY')!

// ── 상수 ──
const API_BASE = 'https://apis.data.go.kr/B552845/katRealTime2/trades2'
const PAGE_SIZE = 1000
const ITEM_KEYWORD = '참외'

/** 수집 대상 공판장 */
const TARGET_CORPS = [
  { corpCd: '11000102', name: '농협가락(공)' },
  { corpCd: '25000101', name: '농협대전(공)' },
]

// ── 유틸 ──

/** KST 기준 현재 시각 */
function getKSTNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}

/** Date → 'YYYY-MM-DD' (KST 기준) */
function formatDateKST(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** JSON 응답 헬퍼 */
function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── API 타입 ──

interface AuctionRecord {
  scsbd_prc: string     // 낙찰가
  qty: string           // 수량
  grd_nm: string        // 등급명
  unit_nm: string       // 단위명
  sz_nm: string         // 크기명
  corp_gds_item_nm: string  // 품목명
  corp_gds_vrty_nm: string  // 품종명
  plor_nm: string       // 산지명
  trd_clcln_ymd: string // 거래정산일자
  corp_nm: string       // 법인명
  whsl_mrkt_nm: string  // 도매시장명
}

interface AggregatedData {
  market_name: string
  market_date: string
  grade: string
  weight: string
  avg_price: number
  min_price: number
  max_price: number
  boxes: number
  record_count: number
}

// ── API 호출 ──

/** 특정 공판장의 참외 데이터를 전체 페이지 조회 */
async function fetchCorpData(corpCd: string, targetDate: string): Promise<AuctionRecord[]> {
  const allRecords: AuctionRecord[] = []
  let pageNo = 1
  let totalCount = 0

  do {
    // data.go.kr API는 cond[] 파라미터에 리터럴 대괄호가 필요
    // URLSearchParams는 []를 %5B%5D로 인코딩하여 API가 인식 못함
    const encodedKey = encodeURIComponent(DATA_API_KEY)
    const url = `${API_BASE}?serviceKey=${encodedKey}` +
      `&cond[trd_clcln_ymd::EQ]=${targetDate}` +
      `&cond[scsbd_dt::LIKE]=${targetDate}` +
      `&cond[corp_cd::EQ]=${corpCd}` +
      `&pageNo=${pageNo}` +
      `&numOfRows=${PAGE_SIZE}` +
      `&returnType=json`
    const res = await fetch(url)

    if (!res.ok) {
      console.error(`API 호출 실패: ${res.status} ${res.statusText}`)
      break
    }

    const json = await res.json()

    // API 응답 구조: { response: { header: { resultCode }, body: { items: { item: [] }, totalCount } } }
    const header = json?.response?.header
    const body = json?.response?.body
    if (!header || String(header.resultCode) !== '0') {
      console.error('API 응답 오류:', header?.resultMsg || JSON.stringify(json).slice(0, 300))
      break
    }

    totalCount = Number(body?.totalCount ?? 0)
    // items.item이 배열 또는 단일 객체
    let items: AuctionRecord[] = body?.items?.item || []
    if (!Array.isArray(items)) items = [items]

    // 참외 필터링
    const chamoeItems = items.filter(
      (item) => item.corp_gds_item_nm?.includes(ITEM_KEYWORD)
    )
    allRecords.push(...chamoeItems)

    // 다음 페이지
    if (pageNo * PAGE_SIZE >= totalCount) break
    pageNo++
  } while (true)

  return allRecords
}

// ── 데이터 집계 ──

/** 한글 Unicode 정규화 (NFD→NFC 통일) */
const normalize = (s: string) => s.normalize('NFC')

/** 개별 경매 기록을 등급·무게별로 집계 */
function aggregateRecords(
  records: AuctionRecord[],
  marketName: string,
  marketDate: string
): AggregatedData[] {
  marketName = normalize(marketName)
  const groups = new Map<string, { prices: number[]; quantities: number[] }>()

  for (const r of records) {
    const price = parseFloat(r.scsbd_prc)
    const qty = parseFloat(r.qty)
    if (isNaN(price) || isNaN(qty) || qty <= 0) continue

    const grade = r.grd_nm?.trim() || '무등급'
    const weight = r.unit_nm?.trim() || '기타'
    const key = `${grade}||${weight}`

    if (!groups.has(key)) {
      groups.set(key, { prices: [], quantities: [] })
    }
    const g = groups.get(key)!
    g.prices.push(price)
    g.quantities.push(qty)
  }

  const result: AggregatedData[] = []
  for (const [key, g] of groups) {
    const [grade, weight] = key.split('||')
    const totalQty = g.quantities.reduce((a, b) => a + b, 0)
    const avgPrice = Math.round(
      g.prices.reduce((sum, p, i) => sum + p * g.quantities[i], 0) / totalQty
    )

    result.push({
      market_name: marketName,
      market_date: marketDate,
      grade,
      weight,
      avg_price: avgPrice,
      min_price: Math.min(...g.prices),
      max_price: Math.max(...g.prices),
      boxes: Math.round(totalQty),
      record_count: g.prices.length,
    })
  }

  return result
}

/** market_data 집계에서 market_summary 생성 */
function buildSummary(
  aggregated: AggregatedData[],
  marketName: string,
  marketDate: string
) {
  marketName = normalize(marketName)
  if (aggregated.length === 0) return null

  const totalBoxes = aggregated.reduce((s, a) => s + a.boxes, 0)
  const totalAmount = aggregated.reduce((s, a) => s + a.avg_price * a.boxes, 0)
  const avgPrice = totalBoxes > 0 ? Math.round(totalAmount / totalBoxes) : 0
  const minPrice = Math.min(...aggregated.map((a) => a.min_price))
  const maxPrice = Math.max(...aggregated.map((a) => a.max_price))

  return {
    market_name: marketName,
    market_date: marketDate,
    avg_price: avgPrice,
    min_price: minPrice,
    max_price: maxPrice,
    total_boxes: totalBoxes,
    total_amount: totalAmount,
  }
}

// ── 메인 핸들러 ──

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    // 요청 body 파싱 (한 번만)
    let reqBody: Record<string, unknown> = {}
    try {
      reqBody = await req.json()
    } catch { /* empty body */ }

    // 날짜 결정: 요청 body에 date가 있으면 사용, 없으면 전일자
    let targetDate = String(reqBody.date || '')
    if (!targetDate) {
      const kstNow = getKSTNow()
      const yesterday = new Date(kstNow.getTime() - 24 * 60 * 60 * 1000)
      targetDate = formatDateKST(yesterday)
    }

    console.log(`[collect-market-data] 수집 시작: ${targetDate}`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const results: Record<string, unknown> = {}

    for (const corp of TARGET_CORPS) {
      console.log(`  ${corp.name} (${corp.corpCd}) 조회 중...`)

      // 1. API에서 참외 데이터 조회
      const records = await fetchCorpData(corp.corpCd, targetDate)
      console.log(`  → 참외 ${records.length}건 조회됨`)

      if (records.length === 0) {
        results[corp.name] = { fetched: 0, skipped: true }
        continue
      }

      // 2. 등급·무게별 집계
      const aggregated = aggregateRecords(records, corp.name, targetDate)

      // 3. market_data upsert
      if (aggregated.length > 0) {
        const { error: dataErr } = await supabase
          .from('market_data')
          .upsert(aggregated, {
            onConflict: 'market_name,market_date,grade,weight',
          })

        if (dataErr) {
          console.error(`  market_data upsert 오류:`, dataErr)
          results[corp.name] = { error: dataErr.message }
          continue
        }
      }

      // 4. market_summary upsert (기존 값과 비교하여 is_finalized 판정)
      const summary = buildSummary(aggregated, corp.name, targetDate)
      if (summary) {
        // 기존 데이터 조회 → 값이 동일하면 집계 완료(is_finalized = true)
        const { data: existing } = await supabase
          .from('market_summary')
          .select('avg_price, min_price, max_price, total_boxes, total_amount')
          .eq('market_name', summary.market_name)
          .eq('market_date', summary.market_date)
          .maybeSingle()

        const isFinalized = existing != null
          && existing.avg_price === summary.avg_price
          && existing.min_price === summary.min_price
          && existing.max_price === summary.max_price
          && existing.total_boxes === summary.total_boxes
          && existing.total_amount === summary.total_amount

        const { error: sumErr } = await supabase
          .from('market_summary')
          .upsert({ ...summary, is_finalized: isFinalized }, {
            onConflict: 'market_name,market_date',
          })

        if (sumErr) {
          console.error(`  market_summary upsert 오류:`, sumErr)
        } else if (isFinalized) {
          console.log(`  → ${corp.name} 집계 완료 (변동 없음)`)
        }
      }

      results[corp.name] = {
        fetched: records.length,
        aggregated: aggregated.length,
        summary: summary ? 'ok' : 'no_data',
      }
    }

    console.log(`[collect-market-data] 수집 완료: ${targetDate}`)

    return jsonRes({
      success: true,
      date: targetDate,
      results,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[collect-market-data] error:', msg)
    return jsonRes({ error: msg }, 500)
  }
})
