// Supabase Edge Function - OpenClaw 에이전트 응답 수신기
// 역할: 1) agent_logs 응답 저장 (기존) 2) AI 댓글 삽입 (action: 'post_comment') 3) 광장 글쓰기 + @멘션 알림 (action: 'post_lounge') 4) 광장 읽기 (action: 'get_lounge') 5) 광장 투표 글 생성 (action: 'post_lounge_poll') 6) 이미지 업로드 (action: 'upload_image')
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

// Cloudflare Images (upload_image 액션용)
const CF_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? ''
const CF_API_TOKEN = Deno.env.get('CLOUDFLARE_STREAM_TOKEN') ?? '' // Stream과 Images 공용 토큰

// 미디어 URL 자동 감지용 확장자
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.heic']
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.3gp']

function classifyMediaUrl(url: string): 'image' | 'video' | 'unknown' {
  const lower = new URL(url, 'https://placeholder.com').pathname.toLowerCase()
  if (IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext))) return 'image'
  if (VIDEO_EXTENSIONS.some(ext => lower.endsWith(ext))) return 'video'
  // Cloudflare Images URL 패턴
  if (lower.includes('/cdn-cgi/imagedelivery/') || lower.includes('imagedelivery.net')) return 'image'
  // Cloudflare Stream URL 패턴
  if (lower.includes('videodelivery.net') || lower.includes('customer-') && lower.includes('.cloudflarestream.com')) return 'video'
  return 'unknown'
}

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
      .select(`id, content, image_url, image_urls, video_url, created_at, user_id, poll_id,
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

      // 미디어 URL 포함
      const imageUrl = (m as Record<string, unknown>).image_url as string | null
      const imageUrlsArr = (m as Record<string, unknown>).image_urls as string[] | null
      const videoUrlVal = (m as Record<string, unknown>).video_url as string | null
      if (imageUrl) base.image_url = imageUrl
      if (imageUrlsArr && imageUrlsArr.length > 0) base.image_urls = imageUrlsArr
      if (videoUrlVal) base.video_url = videoUrlVal

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

  // ─── action: upload_image → Base64 이미지를 Cloudflare Images에 업로드 ───
  // 지원 필드:
  //   image_base64 (string) - Base64 인코딩된 이미지 데이터 (필수, data URI 접두사 허용)
  //   filename (string)     - 파일명 (선택, 기본 'openclaw-{timestamp}.jpg')
  //   content_type (string) - MIME 타입 (선택, 기본 'image/jpeg')
  if (action === 'upload_image') {
    let rawBase64 = ((body.image_base64 ?? body.image ?? '') as string).trim()

    if (!rawBase64) {
      return jsonResponse({ error: 'image_base64 is required' }, 400)
    }

    // data URI 접두사 제거 (예: "data:image/png;base64,...")
    let detectedType = 'image/jpeg'
    const dataUriMatch = rawBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/)
    if (dataUriMatch) {
      detectedType = dataUriMatch[1]
      rawBase64 = rawBase64.slice(dataUriMatch[0].length)
    }

    // Base64 디코딩
    let imageBytes: Uint8Array
    try {
      const binaryStr = atob(rawBase64)
      imageBytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        imageBytes[i] = binaryStr.charCodeAt(i)
      }
    } catch {
      return jsonResponse({ error: 'Invalid base64 data' }, 400)
    }

    // 10MB 제한
    if (imageBytes.length > 10 * 1024 * 1024) {
      return jsonResponse({ error: 'Image too large (max 10MB)' }, 400)
    }

    if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
      console.error('[openclaw-response] Cloudflare Images 환경변수 미설정')
      return jsonResponse({ error: 'Cloudflare Images not configured' }, 500)
    }

    const contentType = (body.content_type as string) || detectedType
    const ext = contentType.split('/')[1]?.replace('+xml', '') || 'jpg'
    const filename = (body.filename as string) || `openclaw-${Date.now()}.${ext}`

    try {
      // 1) Direct Upload URL 요청
      const uploadForm = new FormData()
      uploadForm.append('requireSignedURLs', 'false')
      uploadForm.append('metadata', JSON.stringify({
        source: 'openclaw',
        uploadedAt: new Date().toISOString(),
      }))

      const directRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v2/direct_upload`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` },
          body: uploadForm,
        }
      )
      const directData = await directRes.json() as { success: boolean; result?: { uploadURL: string; id: string }; errors?: { message: string }[] }

      if (!directData.success || !directData.result?.uploadURL) {
        console.error('[openclaw-response] CF Direct Upload 실패:', directData.errors)
        return jsonResponse({ error: 'Failed to get upload URL' }, 500)
      }

      // 2) 이미지 파일 업로드
      const imageFile = new File([imageBytes], filename, { type: contentType })
      const imageForm = new FormData()
      imageForm.append('file', imageFile)

      const uploadRes = await fetch(directData.result.uploadURL, {
        method: 'POST',
        body: imageForm,
      })
      const uploadResult = await uploadRes.json() as { success: boolean; result?: { variants?: string[] }; errors?: { message: string }[] }

      if (!uploadResult.success) {
        console.error('[openclaw-response] CF 이미지 업로드 실패:', uploadResult.errors)
        return jsonResponse({ error: 'Image upload failed' }, 500)
      }

      // public variant URL 추출
      const variants = uploadResult.result?.variants ?? []
      const publicUrl = variants.find((v: string) => v.includes('/public')) ?? variants[0] ?? ''

      console.log(`[openclaw-response] 이미지 업로드 완료: id=${directData.result.id}, url=${publicUrl}`)

      return jsonResponse({
        ok: true,
        image_id: directData.result.id,
        url: publicUrl,
        variants,
      })
    } catch (err) {
      console.error('[openclaw-response] 이미지 업로드 예외:', err)
      return jsonResponse({ error: 'Image upload exception' }, 500)
    }
  }

  // ─── action: post_lounge → 광장 메시지 삽입 (전기수) ───
  // 지원 필드:
  //   message/content (string) - 텍스트 (미디어만 보낼 경우 생략 가능)
  //   media_urls (string[])   - 이미지/동영상 URL 배열 (자동 감지)
  //   image_url (string)      - 단일 이미지 URL (직접 지정)
  //   image_urls (string[])   - 다중 이미지 URL (직접 지정)
  //   video_url (string)      - 동영상 URL (직접 지정)
  if (action === 'post_lounge') {
    const message = ((body.message ?? body.content ?? '') as string).trim()

    // 미디어 URL 처리: media_urls 자동 감지 또는 직접 지정
    let imageUrls: string[] = []
    let videoUrl: string | null = null

    // 1) media_urls 자동 감지 (우선)
    const rawMediaUrls = body.media_urls as string[] | undefined
    if (Array.isArray(rawMediaUrls) && rawMediaUrls.length > 0) {
      for (const url of rawMediaUrls) {
        if (typeof url !== 'string' || !url.trim()) continue
        const type = classifyMediaUrl(url.trim())
        if (type === 'video' && !videoUrl) {
          videoUrl = url.trim()
        } else {
          // image, unknown → 이미지로 처리 (unknown도 이미지 fallback)
          imageUrls.push(url.trim())
        }
      }
    }

    // 2) 직접 지정 필드 (media_urls가 없을 때 fallback)
    if (imageUrls.length === 0 && !videoUrl) {
      if (Array.isArray(body.image_urls) && body.image_urls.length > 0) {
        imageUrls = (body.image_urls as string[]).filter(u => typeof u === 'string' && u.trim()).map(u => (u as string).trim())
      }
      if (typeof body.image_url === 'string' && body.image_url.trim()) {
        imageUrls = [body.image_url.trim(), ...imageUrls]
      }
      if (typeof body.video_url === 'string' && body.video_url.trim()) {
        videoUrl = (body.video_url as string).trim()
      }
    }

    const hasMedia = imageUrls.length > 0 || !!videoUrl

    if (!message && !hasMedia) {
      return jsonResponse({ error: 'message or media_urls is required' }, 400)
    }
    if (!AI_USER_ID) {
      console.error('[openclaw-response] AI_USER_ID 시크릿 미설정')
      return jsonResponse({ error: 'AI_USER_ID not configured' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // insert 데이터 구성
    const insertData: Record<string, unknown> = {
      user_id: AI_USER_ID,
      content: message || null,
    }

    if (imageUrls.length === 1) {
      insertData.image_url = imageUrls[0]
    } else if (imageUrls.length > 1) {
      insertData.image_urls = imageUrls
    }

    if (videoUrl) {
      insertData.video_url = videoUrl
    }

    console.log(`[openclaw-response] post_lounge 삽입 데이터:`, JSON.stringify(insertData))

    const { data: inserted, error: insertError } = await supabase
      .from('lounge_messages')
      .insert([insertData])
      .select('id')
      .single()

    if (insertError) {
      console.error('[openclaw-response] 광장 메시지 삽입 실패:', insertError)
      return jsonResponse({ error: insertError.message }, 500)
    }

    console.log(`[openclaw-response] 전기수 광장 글 삽입 완료: id=${inserted.id} (이미지: ${imageUrls.length}장, 동영상: ${videoUrl ? '있음' : '없음'})`)

    // ── @멘션 감지 → 알림 + 푸시 (fire-and-forget) ──
    if (message) {
      const mentionStarts: number[] = []
      for (let idx = 0; idx < message.length; idx++) {
        if (message[idx] === '@' && (idx === 0 || message[idx - 1] === ' ' || message[idx - 1] === '\n')) {
          mentionStarts.push(idx)
        }
      }

      // AI 유저 이름 조회 (알림 제목에 사용)
      let aiName = '전기수'
      if (mentionStarts.length > 0) {
        const { data: aiUser } = await supabase.from('users').select('name').eq('id', AI_USER_ID).maybeSingle()
        if (aiUser?.name) aiName = aiUser.name
      }

      for (const start of mentionStarts) {
        const after = message.slice(start + 1)
        const words = after.split(/\s+/).filter(Boolean).slice(0, 3)
        // 3단어 → 2단어 → 1단어 순으로 시도 (greedy DB 매칭)
        for (let len = words.length; len >= 1; len--) {
          const candidate = words.slice(0, len).join(' ')
          if (!candidate) continue
          const { data: mentioned } = await supabase
            .from('users')
            .select('id')
            .eq('name', candidate)
            .maybeSingle()
          if (mentioned && mentioned.id !== AI_USER_ID) {
            // 개인 알림 저장
            await supabase.from('user_notifications').upsert({
              receiver_id: mentioned.id,
              sender_id: AI_USER_ID,
              type: 'mention',
              title: `${aiName}님이 회원님을 언급했어요`,
              body: message.slice(0, 80),
              url: '/lounge',
              reference_id: inserted.id,
              reference_type: 'lounge_message',
              is_read: false,
            }, {
              onConflict: 'receiver_id,sender_id,type,reference_id,reference_type',
              ignoreDuplicates: true,
            }).then(() => {
              console.log(`[openclaw-response] 멘션 알림 저장: ${candidate} (${mentioned.id})`)
            }).catch((e: unknown) => {
              console.error(`[openclaw-response] 멘션 알림 저장 실패:`, e)
            })
            // 푸시 알림 전송
            try {
              const pushUrl = `${SUPABASE_URL}/functions/v1/send-push`
              await fetch(pushUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  title: `${aiName}님이 회원님을 언급했어요`,
                  body: message.slice(0, 80),
                  url: '/lounge',
                  userId: mentioned.id,
                }),
              })
              console.log(`[openclaw-response] 멘션 푸시 전송: ${candidate}`)
            } catch (pushErr) {
              console.error(`[openclaw-response] 멘션 푸시 실패:`, pushErr)
            }
            break // 가장 긴 매칭으로 확정
          }
        }
      }
    }

    const runId = ((body.run_id ?? '') as string).trim()
    if (runId) {
      await supabase.from('agent_logs').update({
        status:       'done',
        responded_at: new Date().toISOString(),
        response:     message || '[미디어 첨부]',
        metadata:     { action: 'post_lounge', lounge_message_id: inserted.id, image_count: imageUrls.length, has_video: !!videoUrl },
      }).eq('run_id', runId)
    }

    return jsonResponse({ ok: true, lounge_message_id: inserted.id, images: imageUrls.length, video: !!videoUrl })
  }

  // ─── action: post_lounge_poll → 광장 투표 글 생성 (전기수) ───
  // 지원 필드:
  //   question (string)         - 투표 질문 (필수, 최대 100자)
  //   options (string[])        - 선택지 배열 (필수, 2~8개)
  //   content/message (string)  - 함께 보낼 텍스트 (선택)
  //   is_anonymous (boolean)    - 익명 투표 여부 (기본 false)
  //   is_multiple (boolean)     - 복수 선택 허용 (기본 false)
  //   expires_in_hours (number) - 만료 시간 (null이면 무기한)
  if (action === 'post_lounge_poll') {
    const question = ((body.question ?? '') as string).trim()
    const options  = body.options as string[] | undefined
    const content  = ((body.message ?? body.content ?? '') as string).trim()
    const isAnonymous   = (body.is_anonymous ?? false) as boolean
    const isMultiple    = (body.is_multiple ?? false) as boolean
    const expiresInHours = (body.expires_in_hours ?? null) as number | null

    // 검증
    if (!question) {
      return jsonResponse({ error: 'question is required' }, 400)
    }
    if (question.length > 100) {
      return jsonResponse({ error: 'question must be 100 characters or less' }, 400)
    }
    if (!Array.isArray(options) || options.length < 2 || options.length > 8) {
      return jsonResponse({ error: 'options must be an array of 2~8 items' }, 400)
    }
    const cleanedOptions = options
      .map(o => (typeof o === 'string' ? o.trim() : ''))
      .filter(o => o.length > 0)
    if (cleanedOptions.length < 2) {
      return jsonResponse({ error: 'at least 2 non-empty options required' }, 400)
    }

    if (!AI_USER_ID) {
      console.error('[openclaw-response] AI_USER_ID 시크릿 미설정')
      return jsonResponse({ error: 'AI_USER_ID not configured' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1) 투표(lounge_polls) 생성
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
      : null

    const { data: poll, error: pollErr } = await supabase
      .from('lounge_polls')
      .insert({
        user_id:      AI_USER_ID,
        question,
        is_anonymous: isAnonymous,
        is_multiple:  isMultiple,
        expires_at:   expiresAt,
      })
      .select('id')
      .single()

    if (pollErr) {
      console.error('[openclaw-response] 투표 생성 실패:', pollErr)
      return jsonResponse({ error: pollErr.message }, 500)
    }

    // 2) 선택지(lounge_poll_options) 생성
    const optionRows = cleanedOptions.map((label, idx) => ({
      poll_id:    poll.id,
      label,
      sort_order: idx,
    }))

    const { error: optErr } = await supabase
      .from('lounge_poll_options')
      .insert(optionRows)

    if (optErr) {
      console.error('[openclaw-response] 선택지 생성 실패:', optErr)
      return jsonResponse({ error: optErr.message }, 500)
    }

    // 3) 메시지(lounge_messages) 생성 (poll_id 연결)
    const msgData: Record<string, unknown> = {
      user_id: AI_USER_ID,
      poll_id: poll.id,
    }
    if (content) msgData.content = content

    const { data: msg, error: msgErr } = await supabase
      .from('lounge_messages')
      .insert([msgData])
      .select('id')
      .single()

    if (msgErr) {
      console.error('[openclaw-response] 투표 메시지 삽입 실패:', msgErr)
      return jsonResponse({ error: msgErr.message }, 500)
    }

    console.log(`[openclaw-response] 전기수 광장 투표 생성 완료: poll_id=${poll.id}, message_id=${msg.id}, 선택지 ${cleanedOptions.length}개`)

    // agent_logs 기록
    const runId = ((body.run_id ?? '') as string).trim()
    if (runId) {
      await supabase.from('agent_logs').update({
        status:       'done',
        responded_at: new Date().toISOString(),
        response:     `[투표] ${question}`,
        metadata:     { action: 'post_lounge_poll', poll_id: poll.id, lounge_message_id: msg.id, options_count: cleanedOptions.length },
      }).eq('run_id', runId)
    }

    return jsonResponse({
      ok: true,
      poll_id:           poll.id,
      lounge_message_id: msg.id,
      options_count:     cleanedOptions.length,
    })
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
