/**
 * OpenClaw 에이전트 서비스
 * 역할: Edge Function 경유로 OpenClaw 요청 → agent_logs 폴링 → 없으면 Gemini 폴백
 *       (브라우저에서 OpenClaw 직접 호출 시 CORS 차단 → Edge Function이 서버 간 호출)
 *
 * 스케줄 (pg_cron → request-agent Edge Function):
 *   08:00 / 14:00 / 20:00 / 02:00 KST 자동 요청
 *
 * 프론트엔드 진입 시:
 *   getAgentCached()   → 캐시만 즉시 확인 (폴링/트리거 없음)
 *
 * 관리자 수동 재생성 시:
 *   sendToAgent(force) → Edge Function 경유 OpenClaw 요청 → pollResponse
 */

import { supabase } from '../config/supabase.js';

const SUPABASE_URL    = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 오늘 KST 00:00 시각을 UTC ISO string으로 반환
function getKSTTodayStart() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayKST = kst.toISOString().split('T')[0]; // YYYY-MM-DD (KST)
  return new Date(`${todayKST}T00:00:00+09:00`).toISOString();
}

// ──────────────────────────────────────────────
// 1. OpenClaw 요청 (Edge Function 경유 - CORS 우회)
// ──────────────────────────────────────────────

/**
 * OpenClaw 에이전트 요청 (브라우저 CORS 우회: Supabase Edge Function 경유)
 * @param {object} [params]
 * @param {string}  [params.session='seonnam-weather'] - 세션 키
 * @param {boolean} [params.force=false]               - true면 1시간 dedup 우회 (수동 재생성 시)
 * @param {object}  [params.weatherData]               - 날씨 데이터 (있으면 상세 프롬프트 생성)
 * @returns {Promise<string>} runId
 */
export async function sendToAgent({ session = 'seonnam-weather', force = false, weatherData = null } = {}) {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/request-agent`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session, force, weatherData }),
    }
  );

  if (!res.ok) throw new Error(`request-agent 호출 실패: ${res.status}`);

  const data = await res.json();
  const result = data.results?.find(r => r.session === session);

  if (!result)                       throw new Error('세션 결과 없음');
  if (result.error)                  throw new Error(result.error);
  if (result.runId === 'skipped')    throw new Error('최근 데이터 존재 (skipped)');

  return result.runId;
}

// ──────────────────────────────────────────────
// 2. 응답 대기 (타임아웃 없이 응답 올 때까지 폴링)
// ──────────────────────────────────────────────

/**
 * 요청 전송 후 응답이 올 때까지 폴링 (타임아웃 없음)
 * @param {string} session        - 세션 키
 * @param {string} since          - 이 시각 이후 생성된 done 항목을 조회 (ISO string)
 * @param {number} [intervalMs=4000] - 폴링 간격
 * @returns {Promise<string>}     - 응답 텍스트 (무한 대기)
 */
export async function waitForResponse(session, since, intervalMs = 4000, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, intervalMs));

    const { data } = await supabase
      .from('agent_logs')
      .select('response, status')
      .eq('session', session)
      .eq('status', 'done')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.response) return data.response;
  }

  return null; // 60초 타임아웃
}

// ──────────────────────────────────────────────
// 3. 핵심: 최신 데이터 조회 또는 요청 트리거 (프론트엔드 진입 시 호출)
// ──────────────────────────────────────────────

/**
 * 최신 응답 조회 → 없으면 Edge Function 트리거 후 폴링 → 타임아웃 시 null 반환
 * @param {string} [session='seonnam-weather']
 * @returns {Promise<string|null>} 응답 텍스트 or null
 */
export async function getLatestOrRequest(session = 'seonnam-weather') {
  // 최근 CACHE_TTL_MS 내 done 응답 있으면 즉시 반환
  const { data: cached } = await supabase
    .from('agent_logs')
    .select('response, created_at')
    .eq('session', session)
    .eq('status', 'done')
    .gte('created_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached?.response) return cached.response;

  // 없으면 Edge Function 트리거 (pg_cron과 동일한 함수)
  try {
    await fetch(
      `${SUPABASE_URL}/functions/v1/request-agent`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session }),
      }
    );
  } catch {
    return null; // Edge Function 호출 실패 → 폴백
  }

  // OpenClaw 처리 대기 (최대 60초 폴링)
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000));

    const { data } = await supabase
      .from('agent_logs')
      .select('response, status')
      .eq('session', session)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.response) return data.response;
  }

  return null; // 타임아웃 → 호출측에서 Gemini 폴백
}

// ──────────────────────────────────────────────
// 4. 캐시 전용 조회 (폴링/트리거 없이 DB만 확인 - 초기 로드용)
// ──────────────────────────────────────────────

/**
 * 캐시된 응답만 즉시 반환 (트리거/폴링 없음, 초기 로드 시 사용)
 * @param {string} [session='seonnam-weather']
 * @returns {Promise<string|null>} 캐시된 응답 텍스트 or null
 */
export async function getAgentCached(session = 'seonnam-weather') {
  const { data } = await supabase
    .from('agent_logs')
    .select('response, created_at')
    .eq('session', session)
    .eq('status', 'done')
    .gte('created_at', getKSTTodayStart()) // 오늘 KST 00:00 이후 최신 항목
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.response ?? null;
}

// ──────────────────────────────────────────────
// 5. 최근 로그 조회
// ──────────────────────────────────────────────

/**
 * 세션별 최근 로그 조회
 * @param {string} [session]
 * @param {number} [limit=10]
 */
export async function getAgentLogs(session = null, limit = 10) {
  let query = supabase
    .from('agent_logs')
    .select('id, run_id, session, message, response, status, created_at, responded_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (session) query = query.eq('session', session);

  const { data, error } = await query;
  if (error) throw new Error(`로그 조회 실패: ${error.message}`);
  return data ?? [];
}
