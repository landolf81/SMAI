import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID')!

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: Record<string, unknown>
  old_record?: Record<string, unknown>
}

// 텔레그램 메시지 전송
async function sendTelegramMessage(text: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Telegram API error:', error)
    throw new Error(`Telegram API error: ${error}`)
  }

  return response.json()
}

// 신고 알림 메시지 생성
function formatReportMessage(record: Record<string, unknown>): string {
  const reasonMap: Record<string, string> = {
    'spam': '스팸/광고',
    'inappropriate': '부적절한 콘텐츠',
    'harassment': '괴롭힘/따돌림',
    'false_info': '허위 정보',
    'other': '기타',
  }

  const contentTypeMap: Record<string, string> = {
    'post': '게시물',
    'comment': '댓글',
    'user': '사용자',
  }

  const reason = reasonMap[record.reason as string] || record.reason
  const contentType = contentTypeMap[record.content_type as string] || record.content_type

  return `🚨 <b>새 신고 접수</b>

📋 <b>유형:</b> ${contentType}
📝 <b>사유:</b> ${reason}
${record.description ? `💬 <b>상세:</b> ${record.description}` : ''}
🆔 <b>신고 ID:</b> ${record.id}
⏰ <b>시간:</b> ${new Date(record.created_at as string).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}

👉 관리자 페이지에서 확인하세요`
}

// 신규 가입 알림 메시지 생성
function formatNewUserMessage(record: Record<string, unknown>): string {
  const metadata = record.raw_user_meta_data as Record<string, unknown> || {}
  const displayName = metadata.display_name || metadata.name || '(이름 미설정)'
  const email = record.email || '(이메일 없음)'

  return `👋 <b>새 회원가입</b>

👤 <b>이름:</b> ${displayName}
📧 <b>이메일:</b> ${email}
🆔 <b>ID:</b> ${record.id}
⏰ <b>가입일:</b> ${new Date(record.created_at as string).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
}

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json()

    console.log('Received webhook:', payload.table, payload.type)

    // INSERT 이벤트만 처리
    if (payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ message: 'Ignored: not INSERT' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let message: string | null = null

    // 테이블별 메시지 생성
    switch (payload.table) {
      case 'reports':
        message = formatReportMessage(payload.record)
        break
      case 'users':
        message = formatNewUserMessage(payload.record)
        break
      default:
        console.log('Unknown table:', payload.table)
    }

    if (message) {
      await sendTelegramMessage(message)
      console.log('Telegram message sent successfully')
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
