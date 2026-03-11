// Supabase Edge Function - OpenClaw 에이전트 응답 수신기
// 역할: 1) agent_logs 응답 저장 (기존) 2) AI 댓글 삽입 (action: 'post_comment') 3) 광장 글쓰기 (action: 'post_lounge') 4) 광장 읽기 (action: 'get_lounge')
// 배포: supabase functions deploy openclaw-response --no-verify-jwt
// URL: https://<project>.supabase.co/functions/v1/openclaw-response

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const AI_USER_ID = Deno.env.get('AI_USER_ID') ?? ''

// OpenClaw 콜백 검증 토큰
// OPENCLAW_RESPONSE_TOKEN: OpenClaw이 이 웹훅을 호출할 때 쓰는 시크릿 (별도 설정)
// 미설정 시 검증 스킵 (디버깅 단계에서 사용)
const OPENCLAW_RESPONSE_TOKEN = Deno.env.get('OPENCLAW_RESPONSE_TOKEN') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // 수신 Authorization 헤더 로깅 (디버깅용 - 앞 10자리만 노출)
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  const maskedToken = token ? `${token.slice(0, 10)}***` : '(없음)'
  console.log(`[openclaw-response] 수신 Authorization: ${maskedToken}`)
  console.log(`[openclaw-response] OPENCLAW_RESPONSE_TOKEN 설정 여부: ${OPENCLAW_RESPONSE_TOKEN ? '설정됨' : '미설정(검증 스킵)'}`)

  // 토큰 검증: OPENCLAW_RESPONSE_TOKEN이 설정된 경우에만 검증
  if (OPENCLAW_RESPONSE_TOKEN && token !== OPENCLAW_RESPONSE_TOKEN) {
    console.error(`[openclaw-response] 토큰 불일치 - 수신: ${maskedToken}`)
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  // 수신 body 전체 로깅 (형식 디버깅용)
  console.log('[openclaw-response] 수신 body:', JSON.stringify(body))

  const action = ((body.action ?? '') as string).trim()

  // ─── action: get_lounge → 광장 메시지 조회 ───
  if (action === 'get_lounge') {
    const limit      = Math.min(Number(body.limit ?? 30), 100)
    const beforeTime = (body.before_time ?? '') as string

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    let query = supabase
      .from('lounge_messages')
      .select(`id, content, created_at, user_id, poll_id,
        users:user_id (id, name, username),
        lounge_polls:poll_id (
          id, question, is_anonymous, is_multiple, is_closed, expires_at, total_votes,
          lounge_poll_options ( id, label, sort_order, vote_count )
        )`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (beforeTime) {
      query = query.lt('created_at', beforeTime)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      console.error('[openclaw-response] 광장 조회 실패:', fetchError)
      return jsonResponse({ error: fetchError.message }, 500)
    }

    // 오래된 순으로 정렬해서 반환 (대화 흐름 파악에 자연스럽게)
    const messages = (data ?? []).reverse().map((m) => {
      const poll = m.lounge_polls as {
        id: string; question: string; is_anonymous: boolean; is_multiple: boolean;
        is_closed: boolean; expires_at: string | null; total_votes: number;
        lounge_poll_options: { id: string; label: string; sort_order: number; vote_count: number }[];
      } | null

      const base: Record<string, unknown> = {
        id:         m.id,
        content:    m.content,
        created_at: m.created_at,
        author:     (m.users as { name?: string; username?: string } | null)?.name
                    ?? (m.users as { name?: string; username?: string } | null)?.username
                    ?? '알 수 없음',
        is_ai:      m.user_id === AI_USER_ID,
      }

      // 투표 데이터가 있으면 포함
      if (poll) {
        const sortedOptions = [...(poll.lounge_poll_options ?? [])].sort((a, b) => a.sort_order - b.sort_order)
        const isExpired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false

        base.poll = {
          question:     poll.question,
          is_closed:    poll.is_closed || isExpired,
          total_votes:  poll.total_votes,
          options:      sortedOptions.map((o) => ({
            label:      o.label,
            vote_count: o.vote_count,
          })),
        }
      }

      return base
    })

    console.log(`[openclaw-response] 광장 조회 완료: ${messages.length}건`)
    return jsonResponse({ ok: true, messages })
  }

  // ─── action: post_lounge → 광장 메시지 삽입 (전기수) ───
  if (action === 'post_lounge') {
    const message = ((body.message ?? body.content ?? '') as string).trim()

    if (!message) {
      return jsonResponse({ error: 'message is required' }, 400)
    }
    if (!AI_USER_ID) {
      console.error('[openclaw-response] AI_USER_ID 시크릿 미설정')
      return jsonResponse({ error: 'AI_USER_ID not configured' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: inserted, error: insertError } = await supabase
      .from('lounge_messages')
      .insert([{ user_id: AI_USER_ID, content: message }])
      .select('id')
      .single()

    if (insertError) {
      console.error('[openclaw-response] 광장 메시지 삽입 실패:', insertError)
      return jsonResponse({ error: insertError.message }, 500)
    }

    console.log(`[openclaw-response] 전기수 광장 글 삽입 완료: id=${inserted.id}`)

    const runId = ((body.run_id ?? '') as string).trim()
    if (runId) {
      await supabase.from('agent_logs').update({
        status:       'done',
        responded_at: new Date().toISOString(),
        response:     message,
        metadata:     { action: 'post_lounge', lounge_message_id: inserted.id },
      }).eq('run_id', runId)
    }

    return jsonResponse({ ok: true, lounge_message_id: inserted.id })
  }

  // ─── action: post_comment → AI 댓글 삽입 (전기수) ───
  if (action === 'post_comment') {
    const postId   = (body.post_id ?? '') as string
    const comment  = ((body.comment ?? body.content ?? '') as string).trim()
    const parentId = (body.parent_id ?? null) as string | null

    if (!postId || !comment) {
      return jsonResponse({ error: 'post_id and comment are required' }, 400)
    }

    if (!AI_USER_ID) {
      console.error('[openclaw-response] AI_USER_ID 시크릿 미설정')
      return jsonResponse({ error: 'AI_USER_ID not configured' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: inserted, error: insertError } = await supabase
      .from('comments')
      .insert([{
        user_id:     AI_USER_ID,
        post_id:     postId,
        description: comment,
        parent_id:   parentId,
        is_secret:   false,
      }])
      .select('id')
      .single()

    if (insertError) {
      console.error('[openclaw-response] 댓글 삽입 실패:', insertError)
      return jsonResponse({ error: insertError.message }, 500)
    }

    console.log(`[openclaw-response] 전기수 댓글 삽입 완료: comment_id=${inserted.id}, post_id=${postId}`)

    // 선택: agent_logs에도 기록
    const runId = ((body.run_id ?? '') as string).trim()
    if (runId) {
      await supabase.from('agent_logs').update({
        status:       'done',
        responded_at: new Date().toISOString(),
        response:     comment,
        metadata:     { action: 'post_comment', comment_id: inserted.id, post_id: postId },
      }).eq('run_id', runId)
    }

    return jsonResponse({ ok: true, comment_id: inserted.id })
  }

  // ─── 기존 경로: agent_logs 응답 저장 ───
  // run_id 우선순위: 1) URL 쿼리 파라미터 2) body.runId 3) body.run_id
  const urlParams = new URL(req.url).searchParams
  const queryRunId = urlParams.get('run_id') ?? ''
  const runId    = queryRunId || (body.runId ?? body.run_id ?? '') as string
  const response = (body.response ?? body.text ?? body.message ?? body.content ?? '') as string
  const session  = (body.session ?? '') as string
  console.log(`[openclaw-response] runId 결정: queryParam=${queryRunId || '(없음)'} / body=${(body.runId ?? body.run_id) || '(없음)'} → 사용: ${runId}`)

  if (!runId || !response) {
    console.error('[openclaw-response] 필수 필드 누락 - keys:', Object.keys(body))
    return jsonResponse({ error: 'runId and response required', received: body }, 400)
  }

  // response/status/responded_at만 업데이트 (message는 원본 프롬프트 보존)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { error } = await supabase
    .from('agent_logs')
    .update({
      response,
      status:       'done',
      responded_at: new Date().toISOString(),
      metadata:     { ...((body.metadata as object) ?? {}), raw: body },
    })
    .eq('run_id', runId)

  if (error) {
    console.error('[openclaw-response] DB 업데이트 실패:', error)
    return jsonResponse({ error: error.message }, 500)
  }

  console.log(`[openclaw-response] runId=${runId} session=${session} 응답 저장 완료`)

  return jsonResponse({ ok: true, runId })
})
