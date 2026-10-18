export const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export function shareHead(meta) {
  const e = escapeHtml;
  return `<title>${e(meta.title)}</title>
<meta name="description" content="${e(meta.description)}" />
<link rel="canonical" href="${e(meta.url)}" />
<meta name="robots" content="${meta.available ? 'index, follow' : 'noindex, nofollow'}" />
<meta property="og:type" content="${e(meta.type)}" />
<meta property="og:site_name" content="참외이야기" />
<meta property="og:title" content="${e(meta.title)}" />
<meta property="og:description" content="${e(meta.description)}" />
<meta property="og:image" content="${e(meta.image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${e(meta.title)}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:url" content="${e(meta.url)}" />
<meta property="og:locale" content="ko_KR" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${e(meta.title)}" />
<meta name="twitter:description" content="${e(meta.description)}" />
<meta name="twitter:image" content="${e(meta.image)}" />
<meta name="twitter:image:alt" content="${e(meta.title)}" />`;
}
export function injectShareHead(html, meta) {
  return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name=["'](?:description|robots|twitter:[^"']+)["']|property=["']og:[^"']+["'])[^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<\/head>/i, `${shareHead(meta)}\n</head>`);
}
