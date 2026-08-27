// Push notification handler — imported into the Workbox-generated service worker
// via workbox.importScripts in nuxt.config.ts
//
// Supports both Declarative Web Push (DWP, Safari 18.4+) and legacy Push API.
// The server sends a single declarative payload; Safari renders it natively.
// Chrome/Firefox never wake the SW for DWP payloads, so we handle both formats
// in the push event as a fallback.
//
// notificationclose is intentionally NOT handled — OS-level dismiss does not
// modify server state. Only in-app dismiss (user taps X) calls PATCH /api/notifications/:id/dismiss.

const PUSH_SUBSCRIPTION_KEY = 'collct-push-subscription'

function getSubscriptionCredentials() {
  try {
    return JSON.parse(localStorage.getItem(PUSH_SUBSCRIPTION_KEY) || 'null')
  } catch {
    return null
  }
}

function navigateToPath(url) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    const targetUrl = `${self.registration.scope}${url.replace(/^\//, '')}`
    for (const client of clientList) {
      if (client.url === targetUrl && 'focus' in client) {
        return client.focus()
      }
    }
    return self.clients.openWindow(url)
  })
}

// --- Push event ---

self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[push] Received push event with no data')
    return
  }

  let raw
  try {
    raw = event.data.json()
  } catch (err) {
    console.warn('[push] Failed to parse push data as JSON:', err)
    return
  }

  // Declarative Web Push (DWP) — Safari renders natively, never reaches here.
  // But if Chrome/Firefox receive a DWP payload, handle it as a fallback.
  if (raw.web_push === 8030 && raw.notification) {
    const n = raw.notification
    const notificationData = n.data || {}

    event.waitUntil(
      self.registration.showNotification(n.title || 'Collct', {
        body: n.body || '',
        icon: n.icon || '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: n.tag || undefined,
        image: n.image || undefined,
        silent: n.silent || undefined,
        requireInteraction: n.requireInteraction || undefined,
        renotify: n.renotify || undefined,
        vibrate: n.vibrate || undefined,
        timestamp: n.timestamp || undefined,
        data: {
          ...notificationData,
          navigate: n.navigate || undefined,
        },
        ...(n.actions?.length ? { actions: n.actions.map(a => ({ action: a.action, title: a.title, icon: a.icon })) } : {}),
      }).catch((err) => {
        console.error('[push] Failed to show DWP notification:', err)
      })
    )
    return
  }

  // Legacy push payload
  const type = raw.data?.type || raw.type || 'notification'
  const fallbackBody = type === 'group_join'
    ? 'joined a group'
    : type === 'like'
      ? 'liked your photo'
      : type === 'comment'
        ? 'commented on your photo'
        : type === 'moment'
          ? 'Your moment is ready!'
          : type === 'new_post'
            ? 'posted a new photo'
            : 'interacted with your content'

  const notificationData = raw.data || {}

  event.waitUntil(
    self.registration.showNotification(raw.title || 'Collct', {
      body: raw.body || fallbackBody,
      icon: raw.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: raw.tag || undefined,
      data: notificationData,
    }).catch((err) => {
      console.error('[push] Failed to show notification:', err)
    })
  )
})

// --- Notification click ---

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data || {}

  // DWP payloads include a navigate URL directly
  if (data.navigate) {
    event.waitUntil(navigateToPath(data.navigate))
    return
  }

  // Legacy: derive URL from type/id
  let url = '/'
  if (data.type === 'moment') {
    url = '/?moment=capture'
  } else if (data.photoId) {
    url = `/post/${data.photoId}`
  } else if (data.groupId) {
    url = `/groups/${data.groupId}`
  }

  event.waitUntil(navigateToPath(url))
})

// --- Subscription change ---

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[push] Subscription changed, re-registering...')

  event.waitUntil(
    (event.oldSubscription
      ? event.oldSubscription.unsubscribe().catch(() => {})
      : Promise.resolve()
    ).then(() => {
      return self.registration.pushManager.subscribe(
        event.oldSubscription?.options || { userVisibleOnly: true }
      )
    }).then((subscription) => {
      console.log('[push] Re-registered subscription:', subscription.endpoint)

      const creds = getSubscriptionCredentials()
      if (creds?.serverUrl && creds?.token) {
        return fetch(`${creds.serverUrl}/api/notifications/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${creds.token}`
          },
          body: JSON.stringify(subscription.toJSON())
        }).catch((err) => {
          console.warn('[push] Failed to send re-subscription to server:', err)
        })
      }
    }).catch((err) => {
      console.error('[push] Failed to re-register on subscription change:', err)
    })
  )
})
