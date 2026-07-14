/**
 * Minimaler Service Worker nur für Web-Push in der lokalen Entwicklung.
 * Produktion nutzt weiterhin /sw.js (Serwist). Kein Precache – vermeidet Dev-Cache-Probleme.
 */

function isPushPayload(raw) {
  return (
    raw &&
    typeof raw === 'object' &&
    raw.schema_version === 1 &&
    raw.type === 'rastplatz_nearby' &&
    typeof raw.title === 'string' &&
    typeof raw.body === 'string' &&
    typeof raw.tag === 'string'
  )
}

function resolveUrl(payload) {
  if (payload.url && String(payload.url).trim()) return String(payload.url).trim()
  return '/rastplaetze'
}

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = null
  try {
    const raw = event.data.json()
    if (isPushPayload(raw)) payload = raw
  } catch {
    /* ignore */
  }

  if (payload) {
    event.waitUntil(
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/icons/192?v=5',
        badge: '/icons/192?v=5',
        tag: payload.tag,
        data: {
          schema_version: payload.schema_version,
          type: payload.type,
          url: resolveUrl(payload),
          ...(payload.data || {}),
        },
      })
    )
    return
  }

  const fallbackBody = event.data.text()
  event.waitUntil(
    self.registration.showNotification('Camping Packliste', {
      body: fallbackBody || '',
      icon: '/icons/192?v=5',
      badge: '/icons/192?v=5',
      tag: 'generic',
      data: { url: '/', type: 'generic' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url && client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
