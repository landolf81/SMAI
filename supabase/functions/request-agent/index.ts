// Supabase Edge Function - OpenClaw 에이전트 요청 발송
// 역할: pg_cron(8/14/20/02시 KST) 또는 프론트엔드 수동 트리거 시 호출
//       → /hooks/agent 로 요청 전송 (OpenClaw이 처리 후 agent_logs에 직접 저장)
// 배포: supabase functions deploy request-agent

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENCLAW_HOOK_URL        = 'https://openclaw.seonnam.com/hooks/agent'
const OPENCLAW_HOOK_TOKEN      = Deno.env.get('OPENCLAW_HOOK_TOKEN')!

// 기본 세션 설정 (날씨 데이터 없을 때 사용)
const AGENT_SESSIONS = [
  {
    session: 'seonnam-weather',
    message: 'seonnam-melon-weather 스킬을 호출해서 선남면 오늘 날씨 한 줄 브리핑을 만들어줘. 형식: "날씨상태, 기온, 농작업 주의사항" 100자 이내. 결과를 Supabase agent_logs(session: seonnam-weather)에 기록해줘.',
    metadata: { source: 'seonnam.com', skill: 'seonnam-melon-weather' },
  },
]

// 날씨 데이터가 있을 때 상세 프롬프트 생성 (Gemini와 동일한 데이터 구조)
function buildWeatherMessage(weatherData: any): string {
  const { current, daily } = weatherData
  const today    = daily?.[0]
  const tomorrow = daily?.[1]
  const skyMap: Record<number, string> = { 1: '맑음', 3: '구름많음', 4: '흐림' }
  const sky = skyMap[current?.sky] ?? '맑음'

  return `seonnam-melon-weather 스킬을 호출해서 아래 날씨 데이터로 선남면 오늘 날씨 한 줄 브리핑을 만들어줘.
형식: "날씨상태, 기온, 농작업 주의사항" 100자 이내.

[현재 날씨]
현재 기온: ${current?.temp ?? '?'}°C / 하늘: ${sky} / 습도: ${current?.humidity ?? '?'}% / 풍속: ${current?.windSpeed ?? '?'}m/s
오늘 최저/최고: ${today?.minTemp ?? '?'}°C / ${today?.maxTemp ?? '?'}°C
강수확률: ${today?.pop ?? 0}% / 예상 강수량: ${today?.maxPcp ?? '없음'}

[내일 날씨]
최저/최고: ${tomorrow?.minTemp ?? '?'}°C / ${tomorrow?.maxTemp ?? '?'}°C
강수확률: ${tomorrow?.pop ?? 0}% / 예상 강수량: ${tomorrow?.maxPcp ?? '없음'}

[비닐하우스 참외 재배 기준]
- 외기온 5°C 이하: 보온덮개·난방 점검
- 외기온 30°C 이상 또는 맑은 날: 환기창 개방
- 습도 85% 이상: 환기로 병해 예방
- 강풍(5m/s 이상): 비닐 파손 주의
- 강수량 30mm 이상만 침수 주의 언급 (소량 비에 과도한 조언 금지)

[필수 작업]
1. seonnam-melon-weather 스킬 호출
2. 결과를 Supabase agent_logs(session: seonnam-weather)에 기록`
}

// 모든 응답에 공통으로 붙는 CORS 헤더
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 요청 body 파싱
  let targetSessions = AGENT_SESSIONS
  let force = false
  let weatherData: any = null
  try {
    const body = await req.json().catch(() => ({}))
    if (body.session) {
      targetSessions = AGENT_SESSIONS.filter(s => s.session === body.session)
    }
    if (body.force === true) force = true
    if (body.weatherData)   weatherData = body.weatherData  // 날씨 데이터 (프론트에서 전송)
  } catch { /* body 없으면 기본값 사용 */ }

  const results: { session: string; runId?: string; error?: string }[] = []

  for (const config of targetSessions) {
    try {
      // 최근 1시간 내 같은 session 요청이 있으면 스킵 (force=true면 우회)
      if (!force) {
        const { data: recent } = await supabase
          .from('agent_logs')
          .select('id')
          .eq('session', config.session)
          .eq('status', 'done')
          .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
          .limit(1)

        if (recent && recent.length > 0) {
          console.log(`[request-agent] ${config.session} 최근 1시간 내 데이터 존재 → 스킵`)
          results.push({ session: config.session, runId: 'skipped' })
          continue
        }
      }

      // OpenClaw에 요청 전송 (날씨 데이터 있으면 상세 프롬프트 사용)
      const message = weatherData ? buildWeatherMessage(weatherData) : config.message
      const res = await fetch(OPENCLAW_HOOK_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENCLAW_HOOK_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session:  config.session,
          message,
          metadata: config.metadata,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const { runId } = await res.json()
      console.log(`[request-agent] ✅ ${config.session} → runId: ${runId}`)
      results.push({ session: config.session, runId })

    } catch (err) {
      console.error(`[request-agent] ❌ ${config.session}:`, err)
      results.push({ session: config.session, error: String(err) })
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
