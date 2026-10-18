/* global Buffer, process */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { postTitle } from '../src/utils/postShareMetadata.js';
const fontfile = fileURLToPath(new URL('../assets/og/NotoSansKR.ttf', import.meta.url));
process.env.FONTCONFIG_FILE ||= fileURLToPath(new URL('../assets/og/fonts.conf', import.meta.url));
const MAX_BYTES = 6 * 1024 * 1024;
const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export function trustedImageUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.port || u.username || u.password || u.search || u.hash) return null;
    const path = decodeURIComponent(u.pathname);
    if (path.includes('..') || path.includes('\\')) return null;
    const allowed = (u.hostname === 'zynlhezlaxvolpptruiu.supabase.co' && path.startsWith('/storage/v1/object/public/posts/')) || (u.hostname === 'pub-1d5977ce7cec48079bcd6f847b2f3dd1.r2.dev' && path.startsWith('/'));
    if (!allowed || !/\.(png|jpe?g|webp|avif)$/i.test(path)) return null;
    return u.href;
  } catch { return null; }
}
export function representativePhoto(post) {
  let values = post.photo;
  if (typeof values === 'string') { try { values = JSON.parse(values); } catch { values = [values]; } }
  if (!Array.isArray(values)) values = [values];
  return values.map(trustedImageUrl).find(Boolean) || null;
}
export async function fetchPhoto(url, fetchImpl = fetch) {
  if (!trustedImageUrl(url)) return null;
  try {
    const res = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(4000), cache: 'no-store' });
    if (!res.ok || !/^image\/(png|jpeg|webp|avif)(?:;|$)/i.test(res.headers.get('content-type') || '') || Number(res.headers.get('content-length')) > MAX_BYTES) return null;
    const reader = res.body.getReader(); const chunks = []; let length = 0;
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > MAX_BYTES) { await reader.cancel(); return null; } chunks.push(value); }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks);
    // MIME and extension alone cannot exclude disguised SVG documents.
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    const avif = bytes.toString('ascii', 4, 8) === 'ftyp' && /^avi[fs]$/.test(bytes.toString('ascii', 8, 12));
    return png || jpeg || webp || avif ? bytes : null;
  } catch { return null; }
}
async function textLayer(text, size, color, width, maxHeight, weight = 'Bold') {
  for (let n = size; n >= Math.min(size, 30); n -= 2) {
    const make = (value) => ({ text: `<span foreground="${color}">${escape(value)}</span>`, font: `Noto Sans KR ${weight} ${n}`, fontfile, rgba: true, spacing: 7 });
    const measure = async (value) => (await sharp({ text: make(value) }).metadata()).width;
    // Explicit word boundaries prevent awkward breaks halfway through Korean words.
    const lines = []; let line = '';
    for (const word of text.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (await measure(candidate) <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const character of word) {
        if (line && await measure(line + character) > width) { lines.push(line); line = ''; }
        line += character;
      }
    }
    if (line) lines.push(line);
    const { data, info } = await sharp({ text: make(lines.join('\n')) }).png().toBuffer({ resolveWithObject: true });
    if (info.height <= maxHeight && info.width <= width) return data;
  }
  // Extremely long titles are ellipsized in the image; metadata keeps the actual title.
  return textLayer(`${text.slice(0, 55)}…`, 30, color, width, maxHeight, weight);
}
async function visibleVerticalCenter(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let top = info.height; let bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 8) {
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  return bottom < 0 ? info.height / 2 : (top + bottom) / 2;
}
export async function renderPostCard(post, { fetchImpl = fetch } = {}) {
  let photo = await fetchPhoto(representativePhoto(post), fetchImpl);
  if (photo) { try { photo = await sharp(photo, { limitInputPixels: 32e6, animated: false }).rotate().resize(390, 630, { fit: 'cover', position: 'attention' }).png().toBuffer(); } catch { photo = null; } }
  const logo = await readFile(new URL('../public/logo.svg', import.meta.url));
  const title = postTitle(post).slice(0, 300);
  const wide = !photo;
  const layers = [];
  if (photo) layers.push({ input: photo, left: 810, top: 0 });
  else layers.push({ input: await sharp(logo).resize(210, 210).modulate({ saturation: 0.65 }).png().toBuffer(), left: 914, top: 188 });
  const base = Buffer.from(`<svg width="1200" height="630"><rect width="1200" height="630" fill="#F7F6EF"/><rect x="68" y="65" width="36" height="5" rx="2.5" fill="#E8C432"/><path d="M68 516H${wide ? 1132 : 740}" stroke="#D9DED3"/></svg>`);
  const label = post.post_type === 'secondhand' ? '중고거래' : post.post_type === 'qna' ? '질문과 답변' : '농업인 커뮤니티';
  layers.push({ input: await textLayer(label, 23, '#123D2C', 670, 45, 'Medium'), left: 68, top: 90 });
  layers.push({ input: await textLayer(title, 60, '#123D2C', wide ? 810 : 672, 300), left: 64, top: 165 });
  // Do not repeat a long title/body in small type. The title is the focus of this card.
  layers.push({ input: await textLayer('함께 나누는 농사의 지혜', 24, '#5E7166', 670, 40, 'Regular'), left: 68, top: 470 });
  const footerLogo = await sharp(logo).resize(34, 34).png().toBuffer();
  const footerName = await textLayer('참외이야기', 25, '#123D2C', 240, 40);
  const logoTop = 536;
  // Align visible ink bounds, rather than Pango line boxes or SVG canvas bounds.
  const nameTop = Math.round(logoTop + await visibleVerticalCenter(footerLogo) - await visibleVerticalCenter(footerName));
  layers.push({ input: footerLogo, left: 68, top: logoTop });
  layers.push({ input: footerName, left: 114, top: nameTop });
  layers.push({ input: await textLayer('seonnam.com', 20, '#708176', 180, 40, 'Regular'), left: wide ? 970 : 578, top: 541 });
  return sharp(base).composite(layers).png().toBuffer();
}
