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
async function formatReportMessage(record: Record<string, unknown>): Promise<string> {
  // 콘텐츠 타입 결정 (post_id 또는 comment_id로 판단)
  let contentType = '알 수 없음'
  if (record.post_id) {
    contentType = '게시물'
  } else if (record.comment_id) {
    contentType = '댓글'
  }

  // category_id로 카테고리 이름 조회
  let categoryName = '기타'
  if (record.category_id) {
    try {
      const { createClient } = await import('jsr:@supabase/supabase-js@2')
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      const { data: category } = await supabase
        .from('report_categories')
        .select('name')
        .eq('id', record.category_id)
        .single()

      if (category) {
        categoryName = category.name
      }
    } catch (error) {
      console.error('카테고리 조회 오류:', error)
    }
  }

  return `🚨 <b>새 신고 접수</b>

📋 <b>유형:</b> ${contentType}
📝 <b>사유:</b> ${categoryName}
${record.custom_reason ? `💬 <b>상세:</b> ${record.custom_reason}` : ''}
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
        message = await formatReportMessage(payload.record)
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
