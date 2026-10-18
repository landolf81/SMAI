import { getPublicPost, serverPostMetadata } from '../lib/public-post.js';
import { renderPostCard } from '../lib/post-card.js';
import { unavailableMetadata, validPostId } from '../src/utils/postShareMetadata.js';
export default async function handler(req, res) {
  // Revalidate visibility on every request, including old versioned image URLs.
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow','GET, HEAD'); return res.status(405).end(); }
  const { id, format } = req.query;
  if (!validPostId(id)) return res.status(404).json(unavailableMetadata(''));
  try {
    const post = await getPublicPost(id);
    if (!post) return res.status(404).json(unavailableMetadata(id));
    if (format === 'png') {
      const png = await renderPostCard(post);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', png.length);
      return res.status(200).end(req.method === 'HEAD' ? undefined : png);
    }
    return res.status(200).json(serverPostMetadata(post));
  } catch {
    // No error details or data from signed-in sessions enter a public response.
    return res.status(503).json(unavailableMetadata(id));
  }
}
