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
    self.registration.showNotification(data.title || '참외이야기', options)
  );
});

// 알림 클릭 시 해당 URL로 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// SW 설치 시 즉시 활성화
self.addEventListener('install', () => {
  console.log('[SW] 설치됨');
  self.skipWaiting();
});

// 활성화 시 기존 클라이언트 제어
self.addEventListener('activate', (event) => {
  console.log('[SW] 활성화됨');
  event.waitUntil(clients.claim());
});
