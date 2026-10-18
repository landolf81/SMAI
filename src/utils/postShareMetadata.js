// Shared by the Edge renderer and SPA. Never derive public metadata from a signed-in post.
export const SITE_URL = 'https://seonnam.com';
export const DEFAULT_OG_IMAGE = 'https://pub-1d5977ce7cec48079bcd6f847b2f3dd1.r2.dev/logos/og-image.png';
export const CARD_VERSION = 'post-card-v2';
export const validPostId = (id) => /^(?:[1-9]\d{0,15}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i.test(String(id || ''));
// Control characters must be stripped before metadata or Pango rendering.
// eslint-disable-next-line no-control-regex
export const plainText = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
export const isPublicPost = (p) => !!p && p.is_hidden !== true && p.is_private !== true && (p.status == null || p.status === 'published') && !p.deleted_at && !p.is_deleted;
export function postTitle(post) {
  return plainText(post.title) || plainText(post.description).slice(0, 100) || '참외이야기 게시글';
}
export function contentVersion(post) {
  const text = JSON.stringify([CARD_VERSION, post.title, post.description, post.photo, post.updated_at]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `${CARD_VERSION}-${(hash >>> 0).toString(36)}`;
}
export function unavailableMetadata(id) {
  return { available: false, title: '게시글을 볼 수 없습니다 - 참외이야기', description: '공개된 게시글이 없거나 접근할 수 없습니다.', image: DEFAULT_OG_IMAGE, url: `${SITE_URL}/post/${validPostId(id) ? id : ''}`, type: 'website' };
}
export function publicPostMetadata(post, imageOrigin = SITE_URL) {
  if (!isPublicPost(post)) return unavailableMetadata(post?.id);
  const title = postTitle(post).slice(0, 300);
  return { available: true, title, description: plainText(post.description).slice(0, 160) || '성주군 농업인들과 함께 나누는 참외이야기', image: `${imageOrigin}/api/share?id=${encodeURIComponent(post.id)}&format=png&v=${contentVersion(post)}`, url: `${SITE_URL}/post/${post.id}`, type: 'article' };
}
