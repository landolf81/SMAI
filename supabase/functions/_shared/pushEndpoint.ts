/** Push subscriptions are user input; delivery must not become an arbitrary server request. */
export function trustedPushEndpoint(value: unknown) {
  if (typeof value !== 'string' || value.length > 4096) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false
    const host = url.hostname
    return host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' ||
      host === 'web.push.apple.com' || /^[a-z0-9-]+\.notify\.windows\.com$/.test(host)
  } catch { return false }
}
