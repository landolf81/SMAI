/**
 * Service Worker - 푸시 알림 수신 전용
 * 캐싱/오프라인은 하지 않음 (최소 구현)
 */

/* eslint-env serviceworker */

// 푸시 알림 수신
self.addEventListener('push', (event) => {
  console.log('[SW] push 이벤트 수신!', event);

  let data = { title: '참외이야기', body: '새로운 알림이 있습니다.' };

  try {
    if (event.data) {
      const raw = event.data.text();
      console.log('[SW] push 데이터 (raw):', raw);
      data = JSON.parse(raw);
      console.log('[SW] push 데이터 (parsed):', data);
    } else {
      console.log('[SW] push 데이터 없음 (null)');
    }
  } catch (e) {
    console.error('[SW] push 데이터 파싱 오류:', e);
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {
      url: data.url || '/',
    },
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
  };

  console.log('[SW] showNotification 호출:', data.title, options);

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || '참외이야기', options),
      // 앱 아이콘 뱃지 설정 (Android PWA 지원)
      self.navigator?.setAppBadge?.(data.badge_count || 1).catch(() => {}),
    ])
  );
});

// 알림 클릭 시 해당 URL로 이동 + 앱 아이콘 뱃지 제거
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    Promise.all([
      self.navigator?.clearAppBadge?.().catch(() => {}),
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      }),
    ])
  );
});

// ⚠️ 네비게이션 fetch 핸들러 / index.html 캐싱은 의도적으로 제거함.
// 이유: 배포 시 index.html → _app.html 로 이름이 바뀌고 모든 경로는 /api/render 로
//       서버 처리됨. SW가 첫 방문 시점의 index.html(구버전 chunk 참조)을 영구 캐시해
//       두면, 재배포 후 죽은 chunk 로드 → vite:preloadError → 무한 새로고침으로
//       iOS Safari가 충돌함. 네비게이션은 서버(/api/render)에 맡기고 SW는 푸시 전용.

// SW 설치 시 즉시 활성화 (대기 중인 구버전 SW 교체)
self.addEventListener('install', () => {
  console.log('[SW] 설치됨 (푸시 전용)');
  self.skipWaiting();
});

// 활성화 시 과거에 캐싱된 stale 셸 캐시를 모두 제거 (충돌 유발 캐시 정리)
self.addEventListener('activate', (event) => {
  console.log('[SW] 활성화됨');
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await clients.claim();
    })()
  );
});
