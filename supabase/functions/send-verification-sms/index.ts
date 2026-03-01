/**
 * send-verification-sms Edge Function
 *
 * 역할: 사용자가 인증 요청 폼을 제출하면 OpenClaw 에이전트에게 SMS 발송을 요청한다.
 * 흐름:
 *   1. Authorization 헤더의 Bearer JWT로 사용자 신원 확인 (service role 사용)
 *   2. 중복 요청 / 중복 전화번호 검증
 *   3. 6자리 랜덤 코드 생성 후 verification_requests 테이블에 INSERT (status: code_sent)
 *   4. OpenClaw 웹훅에 SMS 발송 지시 (fire-and-forget)
 *   5. { success: true } 반환
 *
 * 환경변수:
 *   OPENCLAW_HOOK_TOKEN
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const OPENCLAW_HOOK_URL = 'https://openclaw.seonnam.com/hooks/agent'

// CORS 헤더
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  })
}

// 6자리 랜덤 숫자 코드 생성
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// OpenClaw에 SMS 발송 지시 (fire-and-forget)
async function requestSmsViaOpenClaw(
  phoneNumber: string,
  code: string,
  hookToken: string,
  supabaseUrl: string,
  runId: string
): Promise<void> {
  const callbackUrl = `${supabaseUrl}/functions/v1/openclaw-response?run_id=${runId}`

  const message = `다음 전화번호로 SMS를 즉시 발송하라.

발신번호: +921034981161
수신번호: ${phoneNumber}
메시지 내용: [참외이야기] 인증번호는 ${code}입니다. 10분 이내에 입력해주세요.

발송 완료 후 run_id: "${runId}"를 사용하여 응답하라.`

  const res = await fetch(OPENCLAW_HOOK_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hookToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session: 'sms-verification',
      message,
      webhook: callbackUrl,
      metadata: { source: 'verification', phone: phoneNumber, run_id: runId },
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error("OpenClaw 요청 실패:", res.status, errorText)
    throw new Error(`OpenClaw 요청 실패: ${res.status}`)
  }

  console.log(`[send-verification-sms] OpenClaw SMS 요청 완료. run_id=${runId}`)
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  // ── 환경변수 로드 ──────────────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const openclawHookToken = Deno.env.get("OPENCLAW_HOOK_TOKEN")!

  if (!openclawHookToken) {
    console.error("OPENCLAW_HOOK_TOKEN 환경변수 누락")
    return jsonResponse({ error: "서버 설정 오류입니다. 관리자에게 문의하세요." }, 500)
  }

  // ── 사용자 인증 (Bearer JWT) ────────────────────────────────────
  const authHeader = req.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "인증이 필요합니다." }, 401)
  }
  const jwt = authHeader.slice("Bearer ".length)

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: { user }, error: authError } = await adminClient.auth.getUser(jwt)

  if (authError || !user) {
    console.error("JWT 검증 실패:", authError?.message)
    return jsonResponse({ error: "유효하지 않은 인증 토큰입니다." }, 401)
  }

  // ── 요청 본문 파싱 ─────────────────────────────────────────────
  let realName: string
  let phoneNumber: string

  try {
    const body = await req.json()
    realName = (body.realName ?? "").toString().trim()
    phoneNumber = (body.phoneNumber ?? "").toString().trim()
  } catch {
    return jsonResponse({ error: "잘못된 요청 형식입니다." }, 400)
  }

  // ── 입력값 유효성 검사 ─────────────────────────────────────────
  if (!realName || realName.length < 2) {
    return jsonResponse({ error: "실명을 2자 이상 입력해주세요." }, 400)
  }

  const phonePattern = /^010-\d{4}-\d{4}$/
  if (!phonePattern.test(phoneNumber)) {
    return jsonResponse({ error: "올바른 휴대폰 번호 형식이 아닙니다. (010-XXXX-XXXX)" }, 400)
  }

  // ── 중복 요청 확인 ────────────────────────────────────────────
  const { data: existingRequest, error: existingError } = await adminClient
    .from("verification_requests")
    .select("id, status, code_expires_at")
    .eq("user_id", user.id)
    .in("status", ["pending", "code_sent"])
    .maybeSingle()

  if (existingError) {
    console.error("중복 요청 조회 오류:", existingError)
    return jsonResponse({ error: "요청 처리 중 오류가 발생했습니다." }, 500)
  }

  // code_sent + 아직 만료 안 됨 → 재발송 방지 (10분 내 재요청 차단)
  if (existingRequest?.status === "code_sent") {
    const expires = existingRequest.code_expires_at ? new Date(existingRequest.code_expires_at) : null
    if (expires && expires > new Date()) {
      const remainMin = Math.ceil((expires.getTime() - Date.now()) / 60000)
      return jsonResponse({ error: `이미 인증번호가 발송되었습니다. ${remainMin}분 후 재요청 가능합니다.` }, 409)
    }
  }

  // ── 전화번호 중복 확인 (다른 사용자가 이미 승인받은 전화번호) ────
  const { data: duplicatePhone, error: duplicateError } = await adminClient
    .from("verification_requests")
    .select("id, user_id")
    .eq("phone_number", phoneNumber)
    .eq("status", "approved")
    .neq("user_id", user.id)
    .maybeSingle()

  if (duplicateError) {
    console.error("전화번호 중복 조회 오류:", duplicateError)
    return jsonResponse({ error: "요청 처리 중 오류가 발생했습니다." }, 500)
  }

  if (duplicatePhone) {
    return jsonResponse({ error: "이미 다른 사용자가 인증한 전화번호입니다." }, 409)
  }

  // ── 인증 코드 생성 및 만료 시간 설정 (10분) ───────────────────
  const code = generateCode()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)
  const runId = crypto.randomUUID()

  // ── verification_requests INSERT 또는 UPDATE (pending 재사용) ──
  let requestId: string

  if (existingRequest) {
    // pending 레코드가 있으면 code_sent로 업데이트 (재사용)
    const { error: updateError } = await adminClient
      .from("verification_requests")
      .update({
        real_name: realName,
        phone_number: phoneNumber,
        verification_code: code,
        code_generated_at: now.toISOString(),
        code_expires_at: expiresAt.toISOString(),
        status: "code_sent",
        updated_at: now.toISOString(),
      })
      .eq("id", existingRequest.id)

    if (updateError) {
      console.error("verification_requests UPDATE 오류:", updateError)
      return jsonResponse({ error: "인증 요청 업데이트 중 오류가 발생했습니다." }, 500)
    }

    requestId = existingRequest.id
    console.log(`[send-verification-sms] pending 레코드 재사용. requestId=${requestId}`)
  } else {
    // 신규 INSERT
    const { data: insertedRequest, error: insertError } = await adminClient
      .from("verification_requests")
      .insert([{
        user_id: user.id,
        real_name: realName,
        phone_number: phoneNumber,
        verification_code: code,
        code_generated_at: now.toISOString(),
        code_expires_at: expiresAt.toISOString(),
        status: "code_sent",
      }])
      .select("id")
      .single()

    if (insertError) {
      console.error("verification_requests INSERT 오류:", insertError)
      return jsonResponse({ error: "인증 요청 저장 중 오류가 발생했습니다." }, 500)
    }

    requestId = insertedRequest.id
    console.log(`[send-verification-sms] 신규 저장 완료. requestId=${requestId}`)
  }

  // ── OpenClaw에 SMS 발송 요청 ───────────────────────────────────
  try {
    await requestSmsViaOpenClaw(phoneNumber, code, openclawHookToken, supabaseUrl, runId)
  } catch (smsError) {
    console.error("OpenClaw SMS 요청 실패:", smsError)

    // 실패 시 롤백 (신규 INSERT였던 경우만 삭제, pending 재사용은 원래 pending으로 복구)
    if (existingRequest) {
      await adminClient
        .from("verification_requests")
        .update({ status: "pending", verification_code: null, updated_at: new Date().toISOString() })
        .eq("id", requestId)
    } else {
      await adminClient
        .from("verification_requests")
        .delete()
        .eq("id", requestId)
    }

    return jsonResponse({ error: "SMS 발송 요청에 실패했습니다. 잠시 후 다시 시도해주세요." }, 502)
  }

  return jsonResponse({ success: true })
})
