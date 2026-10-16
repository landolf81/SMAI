/** Provider-backed media ownership. Legacy assets without an owner require an admin. */
import { authorize, json } from './authorization.ts'

type Dependencies = { env?: { get(name: string): string | undefined }; fetcher?: typeof fetch }
export function createMediaHandler(kind: 'image' | 'video', action: 'upload' | 'delete', deps: Dependencies = {}) {
  return async (req: Request) => {
    const access = await authorize(req, 'user', deps)
    if (access instanceof Response) return access
    const env = deps.env || Deno.env, fetcher = deps.fetcher || fetch
    const account = env.get('CLOUDFLARE_ACCOUNT_ID'), token = env.get('CLOUDFLARE_STREAM_TOKEN')
    if (!account || !token) return json({ error: 'Media service unavailable' }, 503)
    try {
      if (Number(req.headers.get('content-length') || 0) > 12000) return json({ error: 'Request too large' }, 413)
      const raw = await req.text()
      if (raw.length > 12000) return json({ error: 'Request too large' }, 413)
      let body
      try { body = JSON.parse(raw) } catch { return json({ error: 'Invalid JSON' }, 400) }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request' }, 400)
      const root = `https://api.cloudflare.com/client/v4/accounts/${account}`
      const headers = { Authorization: `Bearer ${token}` }
      if (action === 'delete') {
        const id = kind === 'image' ? body.imageId : body.uid
        if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return json({ error: 'Invalid media ID' }, 400)
        const url = `${root}/${kind === 'image' ? 'images/v1' : 'stream'}/${id}`
        const details = await fetcher(url, { headers, signal: AbortSignal.timeout(8000) })
        if (details.status === 404) return json({ success: true })
        if (!details.ok) return json({ error: 'Media lookup failed' }, 502)
        const data = await details.json()
        if (!data.success) return json({ error: 'Media lookup failed' }, 502)
        // creator is set by this server when issuing the direct upload URL.
        // Never trust an owner sent in the delete request or a public post URL.
        if (!access.admin && data.result?.creator !== access.userId) return json({ error: 'Forbidden' }, 403)
        const deleted = await fetcher(url, { method: 'DELETE', headers, signal: AbortSignal.timeout(8000) })
        if (![200, 204, 404].includes(deleted.status)) return json({ error: 'Media deletion failed' }, 502)
        return json({ success: true })
      }
      const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      let requestBody: string | FormData
      let path: string
      if (kind === 'image') {
        const metadata = body.metadata || {}
        if (typeof metadata !== 'object' || Array.isArray(metadata) || JSON.stringify(metadata).length > 8000) return json({ error: 'Invalid metadata' }, 400)
        if (!Number.isFinite(metadata.size) || metadata.size < 1 || metadata.size > 10 * 1024 * 1024 || !/^image\//.test(metadata.type || '')) return json({ error: 'Invalid image size/type' }, 400)
        const form = new FormData()
        form.append('requireSignedURLs', String(body.requireSignedURLs === true))
        form.append('creator', access.userId || 'internal')
        form.append('expiry', expiry)
        form.append('metadata', JSON.stringify({ originalName: String(metadata.originalName || '').slice(0, 200), uploadedAt: new Date().toISOString() }))
        requestBody = form; path = 'images/v2/direct_upload'
      } else {
        const duration = body.maxDurationSeconds ?? 120
        if (!Number.isFinite(duration) || duration < 1 || duration > 120) return json({ error: 'Invalid duration' }, 400)
        requestBody = JSON.stringify({ maxDurationSeconds: duration, requireSignedURLs: false,
          expiry, creator: access.userId || 'internal', meta: { uploadedAt: new Date().toISOString() } })
        path = 'stream/direct_upload'
      }
      const response = await fetcher(`${root}/${path}`, {
        method: 'POST', headers: { ...headers, ...(typeof requestBody === 'string' ? { 'Content-Type': 'application/json' } : {}) },
        body: requestBody, signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) return json({ error: 'Upload URL unavailable' }, 502)
      const result = await response.json()
      if (!result.success || !result.result?.uploadURL) return json({ error: 'Upload URL unavailable' }, 502)
      return json(kind === 'image' ? { uploadURL: result.result.uploadURL, id: result.result.id } : { uploadURL: result.result.uploadURL, uid: result.result.uid })
    } catch { return json({ error: 'Media service unavailable' }, 502) }
  }
}
