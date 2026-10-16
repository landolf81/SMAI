/** Resolve user-triggered pushes from a recent stored event, not client text/identity. */
import { authorize, json } from './authorization.ts'

type Dependencies = { env?: { get(name: string): string | undefined }; fetcher?: typeof fetch; now?: () => number }
export async function authorizePush(req: Request, input: Record<string, unknown>, deps: Dependencies = {}) {
  const access = await authorize(req, 'user', deps)
  if (access instanceof Response) return access
  // Admin UI also emits event-only DM/mention payloads. Those use the same canonical event checks.
  const eventRequest = ['dm', 'mention'].includes(String(input.tag)) && (!access.service || input.referenceId !== undefined)
  if ((access.admin || access.service) && !eventRequest) {
    if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200 ||
        typeof input.body !== 'string' || !input.body.trim() || input.body.length > 2000 ||
        (input.userId !== undefined && (typeof input.userId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.userId)))) return json({ error: 'Invalid push' }, 400)
    if (input.url && (typeof input.url !== 'string' || !input.url.startsWith('/') || input.url.startsWith('//') || /[\\\r\n]/.test(input.url))) return json({ error: 'Invalid URL' }, 400)
    return { title: input.title, body: input.body, url: input.url || '/', userId: input.userId,
      actor: access.userId || 'internal', scope: input.userId ? 'push-direct' : 'push-broadcast' }
  }
  const legacy = input.referenceId === undefined
  if (!['dm', 'mention'].includes(String(input.tag)) || (!legacy && !/^[a-zA-Z0-9-]{1,64}$/.test(String(input.referenceId || ''))) ||
      (legacy && (typeof input.body !== 'string' || !input.body || input.body.length > 61)) ||
      !/^[a-f0-9-]{36}$/i.test(String(input.userId || ''))) return json({ error: 'Forbidden' }, 403)
  const env = deps.env || Deno.env, fetcher = deps.fetcher || fetch
  const headers = { apikey: env.get('SUPABASE_SERVICE_ROLE_KEY')!, Authorization: `Bearer ${env.get('SUPABASE_SERVICE_ROLE_KEY')}` }
  const root = `${env.get('SUPABASE_URL')}/rest/v1/`
  const read = async (query: string) => {
    const response = await fetcher(root + query, { headers, signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error('lookup')
    const rows = await response.json()
    if (!Array.isArray(rows)) throw new Error('lookup')
    return rows
  }
  try {
    const dm = input.tag === 'dm'
    const preview = (text: unknown) => typeof text === 'string' ? (text.length > 60 ? text.slice(0, 60) + '…' : text) : ''
    const table = dm ? 'messages' : 'lounge_messages'
    const fields = dm ? 'id,sender_id,receiver_id,content,created_at' : 'id,user_id,content,created_at,is_hidden'
    const now = (deps.now || Date.now)()
    // Old tabs omit referenceId. Search only this caller's recent stored events,
    // match their preview, and reject ambiguous matches. Client title/url are never used.
    const lookup = legacy
      ? `&${dm ? 'sender_id' : 'user_id'}=eq.${encodeURIComponent(access.userId!)}${dm ? `&receiver_id=eq.${encodeURIComponent(String(input.userId))}` : '&is_hidden=eq.false'}&created_at=gte.${encodeURIComponent(new Date(now - 5 * 60 * 1000).toISOString())}&order=created_at.desc,id.desc&limit=50`
      : `&id=eq.${encodeURIComponent(String(input.referenceId))}&limit=1`
    const rows = await read(`${table}?select=${fields}${lookup}`)
    const matches = legacy ? rows.filter(row => preview(row.content) === input.body) : rows
    if (matches.length !== 1) return json({ error: 'Unresolved event' }, 403)
    const event = matches[0]
    if (!event || (dm ? event.sender_id : event.user_id) !== access.userId || (dm && event.receiver_id !== input.userId)) return json({ error: 'Forbidden' }, 403)
    if (!dm && event.is_hidden === true) return json({ error: 'Forbidden' }, 403)
    const eventId = event.id ?? (legacy ? undefined : input.referenceId)
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(String(eventId || ''))) return json({ error: 'Unresolved event' }, 403)
    const age = now - Date.parse(event.created_at)
    if (!Number.isFinite(age) || age < -5000 || age > 5 * 60 * 1000) return json({ error: 'Expired event' }, 403)
    if (!dm) {
      const [receiver] = await read(`users?select=name&id=eq.${encodeURIComponent(String(input.userId))}&limit=1`)
      if (!receiver?.name || typeof event.content !== 'string') return json({ error: 'Forbidden' }, 403)
      // Match the same whitespace-delimited @nickname contract as the lounge composer.
      const escaped = receiver.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (!new RegExp(`(?:^|\\s)@${escaped}(?=\\s|$)`, 'u').test(event.content)) return json({ error: 'Forbidden' }, 403)
    }
    if (input.userId === access.userId) return json({ error: 'Forbidden' }, 403)
    const [sender] = await read(`users?select=name,username&id=eq.${encodeURIComponent(access.userId!)}&limit=1`)
    const name = sender?.name || sender?.username || '참외이야기'
    const text = typeof event.content === 'string' ? event.content : ''
    return { userId: String(input.userId), title: dm ? `💬 ${name}` : `${name}님이 회원님을 언급했어요`,
      body: preview(text), url: dm ? `/dm/${access.userId}` : '/lounge', actor: access.userId!, scope: 'push-event',
      eventKey: `${input.tag}:${eventId}:${input.userId}` }
  } catch { return json({ error: 'Push authorization unavailable' }, 503) }
}
