/**
 * send-push Edge Function
 * 관리자가 모든 구독자에게 Web Push 알림 발송
 * npm:web-push 라이브러리로 암호화 처리 (RFC 8291 준수)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import webpush from "npm:web-push@3.6.7"

const VAPID_SUBJECT = 'mailto:admin@seonnam.com'
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { title, body, url, userId } = await req.json()

    if (!title || !body) {
      return new Response(JSON.stringify({ error: '제목과 내용이 필요합니다' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // service_role 클라이언트로 구독 조회
    // userId 있으면 해당 사용자만, 없으면 전체 구독자 (관리자 브로드캐스트)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    let query = supabase.from('push_subscriptions').select('id, endpoint, keys')
    if (userId) query = query.eq('user_id', userId)
    const { data: subscriptions, error } = await query

    if (error) throw error

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, message: '구독자 없음' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = JSON.stringify({ title, body, url: url || '/' })
    let sent = 0
    let failed = 0
    const expiredIds: string[] = []

    // 각 구독자에게 발송
    for (const sub of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        }

        // web-push로 암호화된 요청 세부사항 생성 (fetch 직접 사용)
        const requestDetails = webpush.generateRequestDetails(
          pushSubscription,
          payload,
          {
            vapidDetails: {
              subject: VAPID_SUBJECT,
              publicKey: VAPID_PUBLIC_KEY,
              privateKey: VAPID_PRIVATE_KEY,
            },
            TTL: 86400,
          }
        )

        // Deno fetch로 푸시 서비스에 전송
        const response = await fetch(requestDetails.endpoint, {
          method: requestDetails.method,
          headers: requestDetails.headers as Record<string, string>,
          body: requestDetails.body,
        })

        if (response.status === 201 || response.status === 202) {
          sent++
        } else if (response.status === 404 || response.status === 410) {
          // 만료된 구독 → 삭제 대상
          expiredIds.push(sub.id)
          failed++
        } else {
          const responseText = await response.text()
          console.error(`Push failed for ${sub.endpoint}: ${response.status} ${responseText}`)
          failed++
        }
      } catch (e: any) {
        console.error(`Push error for ${sub.endpoint}:`, e.message || e)
        failed++
      }
    }

    // 만료된 구독 정리
    if (expiredIds.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredIds)
      console.log(`Cleaned up ${expiredIds.length} expired subscriptions`)
    }

    return new Response(JSON.stringify({ sent, failed, total: subscriptions.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('send-push error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
