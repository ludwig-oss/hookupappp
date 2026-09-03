/* eslint-disable no-restricted-globals */
self.addEventListener('push', (event) => {
  let payload = { title: 'Hook Up', body: '', vibrate: '0', silent: '0', type: '', otherUserId: '' };
  try {
    const text = event.data ? event.data.text() : '{}';
    const data = JSON.parse(text);
    payload = {
      title: data.title || 'Hook Up',
      body: data.body || '',
      vibrate: data.vibrate === '1' || data.vibrate === true ? '1' : '0',
      silent: data.silent === '1' || data.silent === true ? '1' : '0',
      type: data.type || '',
      otherUserId: data.otherUserId || '',
    };
  } catch {
    /* ignore */
  }

  const silent = payload.silent === '1';
  const vibratePattern = !silent && payload.vibrate === '1' ? [200, 100, 200, 100, 200] : undefined;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body || undefined,
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: payload.type === 'chat_disinterest'
        ? `disinterest-${Date.now()}`
        : payload.type === 'texting_help_sos'
          ? `texting-sos-${Date.now()}`
          : payload.type === 'new_interest'
            ? `interest-${Date.now()}`
            : 'hookup',
      renotify: true,
      silent,
      vibrate: vibratePattern,
      data: {
        url: payload.type === 'chat_disinterest' && payload.otherUserId
          ? `/home?open=chat&disinterest=1&other=${encodeURIComponent(payload.otherUserId)}`
          : payload.type === 'texting_help_sos'
            ? '/home'
            : '/',
        type: payload.type,
      },
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
