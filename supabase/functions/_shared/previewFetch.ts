/** SSRF boundary: unknown hosts get a plain link card, never a server fetch. */
const HOSTS = new Set([
  'x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'publish.twitter.com',
  'instagram.com', 'www.instagram.com', 'api.instagram.com',
  'youtube.com', 'www.youtube.com', 'youtu.be',
  'naver.com', 'www.naver.com', 'news.naver.com', 'n.news.naver.com', 'blog.naver.com', 'm.blog.naver.com',
  'daum.net', 'www.daum.net', 'v.daum.net', 'news.daum.net',
  'www.rda.go.kr', 'rda.go.kr', 'www.mafra.go.kr', 'mafra.go.kr', 'www.sj.go.kr',
  'www.seonnam.com', 'seonnam.com',
])
export function previewURL(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('invalid URL')
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':') ||
      /\.(?:local|localhost|internal|test|invalid)$/.test(url.hostname)) throw new Error('invalid URL')
  return url
}
export const canFetchPreview = (url: URL) => HOSTS.has(url.hostname)
export async function fetchPreviewText(value: string | URL, fetcher: typeof fetch = fetch) {
  let url = previewURL(String(value))
  for (let hop = 0; hop <= 3; hop++) {
    if (!canFetchPreview(url)) throw new Error('preview host not allowed')
    const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(5000),
      headers: { Accept: 'text/html,application/json', 'User-Agent': 'SeonnamLinkPreview/1.0' } })
    if ([301,302,303,307,308].includes(response.status)) {
      await response.body?.cancel()
      const location = response.headers.get('location')
      if (!location) throw new Error('invalid redirect')
      url = previewURL(new URL(location, url).href)
      continue
    }
    if (!response.ok || !/^(text\/html|application\/json|application\/xhtml\+xml)(?:;|$)/i.test(response.headers.get('content-type') || '')) throw new Error('preview unavailable')
    if (Number(response.headers.get('content-length') || 0) > 1024 * 1024) { await response.body?.cancel(); throw new Error('preview too large') }
    const reader = response.body?.getReader()
    if (!reader) return ''
    const decoder = new TextDecoder();let text = '', bytes = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > 1024 * 1024) { await reader.cancel(); throw new Error('preview too large') }
        text += decoder.decode(chunk.value, { stream: true })
      }
      return text + decoder.decode()
    } finally { reader.releaseLock() }
  }
  throw new Error('too many redirects')
}
