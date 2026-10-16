/** Durable service-only quota. Missing/unavailable DB support fails before any paid side effect. */
import { json } from './authorization.ts'
type Dependencies = { env?: { get(name: string): string | undefined }; fetcher?: typeof fetch }
export async function reserveSecurityAction(actor: string, scope: string, eventKey: string | undefined, limit: number, windowSeconds: number, deps: Dependencies = {}) {
  const env = deps.env || Deno.env, fetcher = deps.fetcher || fetch
  const key = env.get('SUPABASE_SERVICE_ROLE_KEY'), root = env.get('SUPABASE_URL')
  if (!key || !root) return json({ error: 'Quota unavailable' }, 503)
  try {
    const response = await fetcher(`${root}/rest/v1/rpc/reserve_security_action`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_actor: actor, p_scope: scope, p_event_key: eventKey || null, p_limit: limit,
        p_window_seconds: windowSeconds, p_event_ttl_seconds: 600 }), signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return json({ error: 'Quota unavailable' }, 503)
    const result = await response.json()
    if (result?.allowed === true) return null
    if (result?.reason === 'duplicate') return json({ sent: 0, duplicate: true })
    if (result?.reason === 'rate_limit') return json({ error: 'Rate limit exceeded' }, 429)
    return json({ error: 'Quota unavailable' }, 503)
  } catch { return json({ error: 'Quota unavailable' }, 503) }
}
