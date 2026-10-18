/* global process */
import { validPostId, isPublicPost, publicPostMetadata, SITE_URL } from '../src/utils/postShareMetadata.js';
const PROJECT_HOST = 'zynlhezlaxvolpptruiu.supabase.co';
export async function getPublicPost(id, { fetchImpl = fetch, env = { VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY } } = {}) {
  if (!validPostId(id)) return null;
  const rawUrl = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!rawUrl || !key) throw Object.assign(new Error('Public sharing configuration unavailable'), {code:'configuration_missing'});
  const base = new URL(rawUrl);
  // Deliberately use only the existing public anon key; never fall back to a privileged key.
  if (base.protocol !== 'https:' || base.hostname !== PROJECT_HOST || base.port || base.username || base.password) throw Object.assign(new Error('Invalid public project'), {code:'project_invalid'});
  if (key.startsWith('sb_secret_')) throw Object.assign(new Error('Public key required'), {code:'public_key_invalid'});
  if (key.split('.').length === 3) {
    try { const claim = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (claim.role !== 'anon') throw new Error('role'); }
    catch { throw Object.assign(new Error('Public key required'), {code:'public_key_invalid'}); }
  }
  const url = new URL('/rest/v1/posts', base);
  url.search = new URLSearchParams({ id: `eq.${id}`, select: 'id,title,description,photo,post_type,updated_at,is_hidden,is_private,status', and: '(or(is_hidden.is.null,is_hidden.eq.false),or(is_private.is.null,is_private.eq.false),or(status.is.null,status.eq.published))', limit: '1' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetchImpl(url.href, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Cache-Control': 'no-store' },
      redirect: 'manual', signal: controller.signal,
    });
    if (!response.ok) throw Object.assign(new Error('Public post lookup failed'), {code:`upstream_${response.status}`});
    const rows = await response.json();
    const post = Array.isArray(rows) ? rows[0] : null;
    return isPublicPost(post) ? post : null;
  } finally {
    clearTimeout(timeout);
  }
}

// Use the protected Preview deployment's own image endpoint during review.
// Canonical post links remain on the public site. Never trust forwarded Host headers.
export function serverPostMetadata(post, env = { VERCEL_ENV: process.env.VERCEL_ENV, VERCEL_URL: process.env.VERCEL_URL }) {
  const host = env.VERCEL_URL || '';
  const previewOrigin = env.VERCEL_ENV === 'preview' && /^[a-z0-9-]+\.vercel\.app$/i.test(host)
    ? `https://${host}` : SITE_URL;
  return publicPostMetadata(post, previewOrigin);
}
