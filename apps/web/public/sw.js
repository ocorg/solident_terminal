// Solident service worker: offline fallback page + phone notifications (Web Push).
// Pages are never cached: the site always shows fresh content when online.
const CACHE = 'solident-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// Page navigations: network first, offline page when there is no connection.
// The offline page's own logo comes from the cache when the network is down.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)))
  } else if (event.request.method === 'GET' && new URL(event.request.url).pathname === '/icons/icon-192.png') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/icons/icon-192.png')))
  }
})

// Payload sent by src/lib/push.ts: { title, body, url, tag }
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Solident', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/espace/notifications' },
    }),
  )
})

// Tap on a notification: focus an open Solident window on that page, or open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/espace/notifications', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
          return w.focus().then(() => ('navigate' in w ? w.navigate(url) : null))
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
