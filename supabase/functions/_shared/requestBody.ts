import { json } from './authorization.ts'
/** Enforce a byte cap while reading, not after allocating the entire request. */
export async function readBoundedJSON(req: Request, maxBytes = 12000): Promise<Record<string, unknown> | Response> {
  if (Number(req.headers.get('content-length') || 0) > maxBytes) return json({ error: 'Request too large' }, 413)
  const reader = req.body?.getReader()
  if (!reader) return json({ error: 'Invalid JSON' }, 400)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > maxBytes) { await reader.cancel(); return json({ error: 'Request too large' }, 413) }
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request' }, 400)
    return body
  } catch { return json({ error: 'Invalid JSON' }, 400) }
  finally { reader.releaseLock() }
}
