/** Resolve user-triggered pushes from a recent stored event, not client text/identity. */
import { authorize, json } from './authorization.ts'

type Dependencies = { env?: { get(name: string): string | undefined }; fetcher?: typeof fetch; now?: () => number }
export async function authorizePush(req: Request, input: Record<string, unknown>, deps: Dependencies = {}) {
  const access = await authorize(req, 'user', deps)
  if (access instanceof Response) return access
  // Admin UI also emits event-only DM/mention payloads. Those use the same canonical event checks.
  const eventOnly = ['dm', 'mention'].includes(String(input.tag)) && input.title === undefined && input.body === undefined
  if ((access.admin || access.service) && !eventOnly) {
    if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200 ||
        typeof input.body !== 'string' || !input.body.trim() || input.body.length > 2000 ||
        (input.userId !== undefined && (typeof input.userId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.userId)))) return json({ error: 'Invalid push' }, 400)
    if (input.url && (typeof input.url !== 'string' || !input.url.startsWith('/') || input.url.startsWith('//') || /[\\\r\n]/.test(input.url))) return json({ error: 'Invalid URL' }, 400)
    return { title: input.title, body: input.body, url: input.url || '/', userId: input.userId }
  }
  if (!['dm', 'mention'].includes(String(input.tag)) || !/^[a-zA-Z0-9-]{1,64}$/.test(String(input.referenceId || '')) ||
      !/^[a-f0-9-]{36}$/i.test(String(input.userId || ''))) return json({ error: 'Forbidden' }, 403)
  const env = deps.env || Deno.env, fetcher = deps.fetcher || fetch
  const headers = { apikey: env.get('SUPABASE_SERVICE_ROLE_KEY')!, Authorization: `Bearer ${env.get('SUPABASE_SERVICE_ROLE_KEY')}` }
  const root = `${env.get('SUPABASE_URL')}/rest/v1/`
  const read = async (query: string) => {
    const response = await fetcher(root + query, { headers, signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error('lookup')
    const rows = await response.json()
    return rows[0]
  }
  try {
    const id = encodeURIComponent(String(input.referenceId))
    const dm = input.tag === 'dm'
    const event = await read(`${dm ? 'messages?select=sender_id,receiver_id,content,created_at' : 'lounge_messages?select=user_id,content,created_at'}&id=eq.${id}&limit=1`)
    if (!event || (dm ? event.sender_id : event.user_id) !== access.userId || (dm && event.receiver_id !== input.userId)) return json({ error: 'Forbidden' }, 403)
    const age = (deps.now || Date.now)() - Date.parse(event.created_at)
    if (!Number.isFinite(age) || age < -5000 || age > 5 * 60 * 1000) return json({ error: 'Expired event' }, 403)
    if (!dm) {
      const receiver = await read(`users?select=name&id=eq.${encodeURIComponent(String(input.userId))}&limit=1`)
      if (!receiver?.name || typeof event.content !== 'string') return json({ error: 'Forbidden' }, 403)
      // Match the same whitespace-delimited @nickname contract as the lounge composer.
      const escaped = receiver.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (!new RegExp(`(?:^|\\s)@${escaped}(?=\\s|$)`, 'u').test(event.content)) return json({ error: 'Forbidden' }, 403)
    }
    if (input.userId === access.userId) return json({ error: 'Forbidden' }, 403)
    const sender = await read(`users?select=name,username&id=eq.${encodeURIComponent(access.userId!)}&limit=1`)
    const name = sender?.name || sender?.username || '참외이야기'
    const text = typeof event.content === 'string' ? event.content : ''
    return { userId: String(input.userId), title: dm ? `💬 ${name}` : `${name}님이 회원님을 언급했어요`,
      body: text.length > 60 ? text.slice(0, 60) + '…' : text, url: dm ? `/dm/${access.userId}` : '/lounge' }
  } catch { return json({ error: 'Push authorization unavailable' }, 503) }
}
