/** Shared server boundary. No JWT decoding or user_metadata authorization. */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}
export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})
export function sameSecret(left: string, right: string) {
  const a = new TextEncoder().encode(left), b = new TextEncoder().encode(right)
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] || 0) ^ (b[i] || 0)
  return diff === 0
}
export type Access = { userId: string | null; service: boolean; admin: boolean }
type Dependencies = { env?: { get(name: string): string | undefined }; fetcher?: typeof fetch }
export async function authorize(req: Request, mode: 'user' | 'admin' | 'internal' = 'user', deps: Dependencies = {}): Promise<Access | Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const env = deps.env || Deno.env, fetcher = deps.fetcher || fetch
  const root = env.get('SUPABASE_URL'), serviceKey = env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!root || !serviceKey) return json({ error: 'Service unavailable' }, 503)
  const bearer = req.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9._~-]+)$/)?.[1] || ''
  if (bearer.length > 8192) return json({ error: 'Unauthorized' }, 401)
  // Existing cron/Edge Function callers may retain their service-role credential.
  if (bearer && sameSecret(bearer, serviceKey)) return { userId: null, service: true, admin: true }
  if (mode === 'internal' || !bearer) return json({ error: 'Unauthorized' }, 401)
  try {
    const response = await fetcher(`${root}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${bearer}` }, signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return json({ error: 'Unauthorized' }, response.status >= 500 ? 503 : 401)
    const user = await response.json()
    if (typeof user.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(user.id) || user.is_anonymous) return json({ error: 'Unauthorized' }, 401)
    const rolesResponse = await fetcher(`${root}/rest/v1/admin_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}&role=in.(admin,super_admin)&limit=1`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(5000),
    })
    // Authorization database failures must not silently become permission grants.
    if (!rolesResponse.ok) return json({ error: 'Authorization unavailable' }, 503)
    const roles = await rolesResponse.json()
    const admin = roles.some((item: { role: string }) => ['admin', 'super_admin'].includes(item.role))
    if (mode === 'admin' && !admin) return json({ error: 'Forbidden' }, 403)
    return { userId: user.id, service: false, admin }
  } catch { return json({ error: 'Authorization unavailable' }, 503) }
}
