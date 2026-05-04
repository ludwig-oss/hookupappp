/* eslint-disable no-restricted-globals */
self.addEventListener('push', (event) => {
  let payload = { title: 'Hook Up', body: '', vibrate: '0', type: '' };
  try {
    const text = event.data ? event.data.text() : '{}';
    const data = JSON.parse(text);
    payload = {
      title: data.title || 'Hook Up',
      body: data.body || '',
      vibrate: data.vibrate === '1' || data.vibrate === true ? '1' : '0',
      type: data.type || '',
    };
  } catch {
    /* ignore */
  }

  const vibratePattern = payload.vibrate === '1' ? [200, 100, 200, 100, 200] : undefined;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body || undefined,
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: payload.type === 'new_interest' ? `interest-${Date.now()}` : 'hookup',
      renotify: true,
      vibrate: vibratePattern,
      data: { url: '/', type: payload.type },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
