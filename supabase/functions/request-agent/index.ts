// Supabase Edge Function - OpenClaw 에이전트 요청 발송
// 역할: pg_cron(8/14/20/02시 KST) 또는 프론트엔드 수동 트리거 시 호출
//       → /hooks/agent 로 요청 전송 (OpenClaw이 처리 후 agent_logs에 직접 저장)
// 배포: supabase functions deploy request-agent

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENCLAW_HOOK_URL        = 'https://openclaw.seonnam.com/hooks/agent'
const OPENCLAW_HOOK_TOKEN      = Deno.env.get('OPENCLAW_HOOK_TOKEN')!

// 공통 브리핑 작성 규칙 (기본 메시지 / buildWeatherMessage 공용)
const BRIEFING_RULES = `
출력 대상은 개인이 아니라 다수 농가다.
반드시 아래 형식으로 1줄로 작성:
오늘: {상태} {최저}~{최고}℃ | 내일: {상태} {최저}~{최고}℃ | 시설참외: {운영조치 2~3개}

작성 규칙:
1) 오늘/내일 모두 포함
2) 개인 호칭 금지, 공지형 문체
3) 과장 금지, 실무 지시 중심
4) 새벽 저온 시간대 환기 지양
5) 일출 후 온도 반등 시 단시간 환기 권장
6) 저온·고습 시 관수량은 보수적으로
7) 결로/병해 리스크는 운영 포인트로 짧게 반영

참조 지식(우선):
- seonnam/참외/시설 참외 재배 기술.md
- seonnam/참외/논문-2012-관비재배-토양EC-수량-품질.md`

// 기본 세션 설정 (날씨 데이터 없을 때 사용)
const AGENT_SESSIONS = [
  {
    session:  'seonnam-weather',
    metadata: { source: 'seonnam.com', skill: 'seonnam-melon-weather' },
  },
]

// 메시지 생성 (runId 포함) - OpenClaw에 전달하여 동일 run_id로 저장 요청
function buildMessage(runId: string, weatherData?: any): string {
  const footer = `
브리핑이 준비되면 반드시 run_id: "${runId}"를 사용하여 Supabase agent_logs(session: seonnam-weather)에 저장해주세요.`

  if (!weatherData) {
    return `seonnam-melon-weather 스킬로 성주군 선남면 시설참외 농가용 날씨 브리핑을 작성하라.
${BRIEFING_RULES}
${footer}`
  }

  const { current, daily } = weatherData
  const today    = daily?.[0]
  const tomorrow = daily?.[1]
  const skyMap: Record<number, string> = { 1: '맑음', 3: '구름많음', 4: '흐림' }
  const sky         = skyMap[current?.sky] ?? '맑음'
  const tomorrowSky = skyMap[tomorrow?.sky] ?? (tomorrow?.weather ?? '?')

  return `성주군 선남면 시설참외 농가용 날씨 브리핑을 작성하라.
${BRIEFING_RULES}

[오늘 날씨 데이터]
현재 기온: ${current?.temp ?? '?'}°C / 하늘: ${sky} / 습도: ${current?.humidity ?? '?'}% / 풍속: ${current?.windSpeed ?? '?'}m/s
최저/최고: ${today?.minTemp ?? '?'}°C / ${today?.maxTemp ?? '?'}°C / 강수확률: ${today?.pop ?? 0}% / 강수량: ${today?.maxPcp ?? '없음'}

[내일 날씨 데이터]
최저/최고: ${tomorrow?.minTemp ?? '?'}°C / ${tomorrow?.maxTemp ?? '?'}°C / 강수확률: ${tomorrow?.pop ?? 0}% / 강수량: ${tomorrow?.maxPcp ?? '없음'} / 하늘: ${tomorrowSky}
${footer}`
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
  let weatherData: any = null
  try {
    const body = await req.json().catch(() => ({}))
    if (body.session) {
      targetSessions = AGENT_SESSIONS.filter(s => s.session === body.session)
    }
    if (body.weatherData) weatherData = body.weatherData  // 날씨 데이터 (프론트에서 전송)
  } catch { /* body 없으면 기본값 사용 */ }

  const results: { session: string; runId?: string; error?: string }[] = []

  for (const config of targetSessions) {
    try {
      // 우리가 먼저 runId 생성 → 메시지에 포함 → OpenClaw에 동일 ID로 저장 요청
      const myRunId = crypto.randomUUID()
      const message = buildMessage(myRunId, weatherData ?? undefined)

      // pending row 선INSERT (OpenClaw이 동일 run_id로 UPDATE 가능하도록)
      await supabase.from('agent_logs').insert({
        run_id:  myRunId,
        session: config.session,
        source:  'seonnam.com',
        message: message,
        status:  'pending',
      })

      // OpenClaw에 요청 전송
      // webhook URL에 run_id 포함 → openclaw-response가 우리 row를 정확히 UPDATE
      const callbackUrl = `${SUPABASE_URL}/functions/v1/openclaw-response?run_id=${myRunId}`
      const res = await fetch(OPENCLAW_HOOK_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENCLAW_HOOK_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session:  config.session,
          message,
          webhook:  callbackUrl,
          metadata: { ...config.metadata, run_id: myRunId },
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const ocData = await res.json()
      const ocRunId = ocData.runId ?? null
      console.log(`[request-agent] ✅ ${config.session} → myRunId: ${myRunId} / ocRunId: ${ocRunId} (대기 중...)`)

      // 최대 1분간 폴링 (3초 간격, 최대 20회)
      // 1순위: 우리 myRunId row에 response 채워지면 완료
      // 2순위: OpenClaw 자체 webhook row (session 기준으로 fallback)
      const POLL_INTERVAL_MS = 3000
      const POLL_MAX = 20
      const requestedAt = new Date().toISOString()
      let response: string | null = null

      for (let i = 0; i < POLL_MAX; i++) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))

        // 1순위: 우리 runId로 response 확인
        const { data: myRow } = await supabase
          .from('agent_logs')
          .select('response')
          .eq('run_id', myRunId)
          .maybeSingle()

        if (myRow?.response) {
          response = myRow.response
          console.log(`[request-agent] ✅ ${config.session} → 우리 runId로 응답 수신 (${(i + 1) * 3}초)`)
          break
        }

        // 2순위: OpenClaw webhook 방식 fallback (session 기준 최신 done row)
        const { data: hookRow } = await supabase
          .from('agent_logs')
          .select('run_id, response')
          .eq('session', config.session)
          .eq('source', 'webhook')
          .eq('status', 'done')
          .gte('created_at', requestedAt)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (hookRow?.response) {
          response = hookRow.response
          console.log(`[request-agent] ✅ ${config.session} → webhook fallback 응답 수신 (${(i + 1) * 3}초)`)
          break
        }
      }

      if (!response) {
        console.warn(`[request-agent] ⏱ ${config.session} → 1분 초과, 응답 없음`)
      }

      results.push({ session: config.session, runId: myRunId, ...(response ? { response } : { status: 'pending' }) })

    } catch (err) {
      console.error(`[request-agent] ❌ ${config.session}:`, err)
      results.push({ session: config.session, error: String(err) })
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
