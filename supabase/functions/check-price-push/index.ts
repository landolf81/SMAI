/**
 * check-price-push Edge Function
 * pg_cron에서 KST 11:20~16:00 매 20분 호출
 * 성주군 합계 경락가 데이터가 당일 처음 도착하면 구독자 전원에게 푸시 발송
 * price_push_tracker 테이블의 UNIQUE(market_name, market_date)로 중복 방지
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import webpush from "npm:web-push@3.6.7"

// ── 환경 변수 ──
const VAPID_SUBJECT = 'mailto:admin@seonnam.com'
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ── 상수 ──
const TARGET_REGION = '성주군'
const TRACKER_NAME = '성주군 합계'
const PUSH_URL = '/'

// ── 유틸 ──

/** KST 기준 현재 시각 */
function getKSTNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}

/** Date → 'YYYY-MM-DD' (KST 기준, UTC 필드 사용) */
function formatDateKST(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 숫자 → 천단위 콤마 */
function fmtNum(n: number): string {
  return n.toLocaleString('ko-KR')
}

/** JSON 응답 헬퍼 */
function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── 메인 핸들러 ──

Deno.serve(async (req) => {
  // CORS (수동 테스트용)
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
    const kstNow = getKSTNow()
    const kstHour = kstNow.getUTCHours()
    const todayKST = formatDateKST(kstNow)

    // 1) 시간대 필터: KST 11:20 ~ 16:00 외에는 즉시 리턴
    const kstMinute = kstNow.getUTCMinutes()
    const kstTotalMin = kstHour * 60 + kstMinute
    if (kstTotalMin < 11 * 60 + 20 || kstTotalMin > 16 * 60) {
      return jsonRes({ skipped: true, reason: 'outside_hours', kstHour, kstMinute })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 2) 오늘 이미 발송했는지 확인
    const { data: tracker } = await supabase
      .from('price_push_tracker')
      .select('id')
      .eq('market_name', TRACKER_NAME)
      .eq('market_date', todayKST)
      .maybeSingle()

    if (tracker) {
      return jsonRes({ skipped: true, reason: 'already_pushed', date: todayKST })
    }

    // 3) 오늘 성주군 합계 데이터 존재 여부
    const { data: todayData, error: mktErr } = await supabase
      .from('market_aggregate_summary')
      .select('avg_price, max_price, total_boxes, total_amount')
      .eq('region_name', TARGET_REGION)
      .eq('market_date', todayKST)
      .maybeSingle()

    if (mktErr) throw mktErr
    if (!todayData) {
      return jsonRes({ skipped: true, reason: 'no_data', date: todayKST })
    }

    // 4) 푸시 메시지 구성
    const maxPrice = Number(todayData.max_price) || 0
    const avgPrice = Number(todayData.avg_price) || 0

    const title = '오늘 경매가 도착'
    const body = `최고가 ${fmtNum(maxPrice)}원 평균가 ${fmtNum(avgPrice)}원으로 시작합니다`

    // 5) 구독자 전원 푸시 발송
    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, keys')

    if (subErr) throw subErr

    let sent = 0
    let failed = 0
    const expiredIds: string[] = []
    const total = subs?.length || 0

    if (subs && subs.length > 0) {
      const payload = JSON.stringify({
        title,
        body,
        url: PUSH_URL,
        tag: 'price-update',
      })

      for (const sub of subs) {
        try {
          const details = webpush.generateRequestDetails(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            },
            payload,
            {
              vapidDetails: {
                subject: VAPID_SUBJECT,
                publicKey: VAPID_PUBLIC_KEY,
                privateKey: VAPID_PRIVATE_KEY,
              },
              TTL: 86400,
            },
          )

          const res = await fetch(details.endpoint, {
            method: details.method,
            headers: details.headers as Record<string, string>,
            body: details.body,
          })

          if (res.status === 201 || res.status === 202) {
            sent++
          } else if (res.status === 404 || res.status === 410) {
            expiredIds.push(sub.id)
            failed++
          } else {
            console.error(`Push fail ${sub.endpoint}: ${res.status}`)
            failed++
          }
        } catch (e: any) {
          console.error(`Push error ${sub.endpoint}:`, e.message || e)
          failed++
        }
      }

      // 만료 구독 정리
      if (expiredIds.length > 0) {
        await supabase.from('push_subscriptions').delete().in('id', expiredIds)
      }
    }

    // 6) 추적 테이블 기록 (UNIQUE 제약으로 race condition 방어)
    const { error: trackErr } = await supabase
      .from('price_push_tracker')
      .insert({
        market_name: TRACKER_NAME,
        market_date: todayKST,
        sent,
        failed,
        total,
      })

    if (trackErr?.code === '23505') {
      return jsonRes({ skipped: true, reason: 'race_condition', date: todayKST })
    }

    // 7) push_logs에도 기록 (관리자 페이지 발송 이력)
    await supabase.from('push_logs').insert({
      title,
      body,
      url: PUSH_URL,
      sent,
      failed,
      total,
    })

    console.log(`[check-price-push] ${todayKST}: sent=${sent} failed=${failed} total=${total}`)

    return jsonRes({ pushed: true, date: todayKST, sent, failed, total })
  } catch (e: any) {
    console.error('[check-price-push] error:', e)
    return jsonRes({ error: e.message }, 500)
  }
})
