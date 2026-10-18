import { DEFAULT_OG_IMAGE, SITE_URL } from './postShareMetadata.js';
export const defaultShareMetadata = () => ({ available: true, title: '참외이야기 - 농업인 커뮤니티', description: '성주군 참외 농업인을 위한 커뮤니티. 참외 재배 정보, 시세 확인, 농업인 소통 공간.', image: DEFAULT_OG_IMAGE, url: SITE_URL, type: 'website' });
export function applyShareMetadata(meta, doc = document) {
  const fields = { 'og:type':meta.type, 'og:site_name':'참외이야기', 'og:title':meta.title, 'og:description':meta.description, 'og:image':meta.image, 'og:url':meta.url, 'og:image:width':'1200', 'og:image:height':'630', 'og:image:alt':meta.title, 'og:image:type':'image/png', 'twitter:card':'summary_large_image', 'twitter:title':meta.title, 'twitter:description':meta.description, 'twitter:image':meta.image, 'twitter:image:alt':meta.title, description:meta.description, robots:meta.available ? 'index, follow' : 'noindex, nofollow' };
  doc.title = meta.title;
  for (const [name, content] of Object.entries(fields)) {
    const attr = name.startsWith('og:') ? 'property' : 'name';
    let element = doc.head.querySelector(`meta[${attr}="${name}"]`);
    if (!element) { element = doc.createElement('meta'); element.setAttribute(attr,name); doc.head.appendChild(element); }
    element.setAttribute('content',content);
  }
  let canonical = doc.head.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = doc.createElement('link'); canonical.setAttribute('rel','canonical'); doc.head.appendChild(canonical); }
  canonical.setAttribute('href',meta.url);
}
