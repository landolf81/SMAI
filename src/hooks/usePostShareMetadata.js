import { useEffect } from 'react';
import { validPostId, unavailableMetadata } from '../utils/postShareMetadata.js';
import { applyShareMetadata, defaultShareMetadata } from '../utils/shareDocument.js';
export function usePostShareMetadata(pathname) {
  useEffect(() => {
    const controller = new AbortController();
    const match = pathname.match(/^\/post\/([^/]+)\/?$/);
    if (!match) { applyShareMetadata(defaultShareMetadata()); return () => controller.abort(); }
    // Clear metadata from the previous post before the asynchronous public lookup.
    applyShareMetadata(unavailableMetadata(match[1]));
    if (validPostId(match[1])) {
      fetch(`/api/share?id=${encodeURIComponent(match[1])}`, { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) throw new Error('Unavailable');
          return response.json();
        })
        .then((meta) => { if (!controller.signal.aborted) applyShareMetadata(meta); })
        .catch(() => { if (!controller.signal.aborted) applyShareMetadata(unavailableMetadata(match[1])); });
    }
    return () => controller.abort();
  }, [pathname]);
}
