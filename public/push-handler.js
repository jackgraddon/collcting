// Push notification handler — imported into the Workbox-generated service worker
// via workbox.importScripts in nuxt.config.ts
//
// Supports both Declarative Web Push (DWP, Safari 18.4+) and legacy Push API.
// The server sends a single declarative payload. On DWP-capable browsers
// (capability recorded at subscribe time) the browser displays natively and
// the SW skips showNotification; everywhere else the SW displays manually.
//
// notificationclose is intentionally NOT handled — OS-level dismiss does not
// modify server state. Only in-app dismiss (user taps X) calls PATCH /api/notifications/:id/dismiss.

// Push credentials live in IndexedDB — localStorage does not exist in
// service worker scope. Records are keyed per endpoint so multi-account
// setups report rotations to the right server. The page writes them via
// the matching helpers in app/utils/pushCredentials.ts (same DB/store names).
const CREDS_DB = 'collct-push-credentials'
const CREDS_STORE = 'credentials'
const META_STORE = 'meta'

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CREDS_DB, 2)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(CREDS_STORE)) {
        req.result.createObjectStore(CREDS_STORE, { keyPath: 'endpoint' })
      }
      if (!req.result.objectStoreNames.contains(META_STORE)) {
        req.result.createObjectStore(META_STORE, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function getCredentials(endpoint) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(CREDS_STORE, 'readonly').objectStore(CREDS_STORE).get(endpoint)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  }))
}

function saveCredentials(record) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(CREDS_STORE, 'readwrite')
    tx.objectStore(CREDS_STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  }))
}

function deleteCredentials(endpoint) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(CREDS_STORE, 'readwrite')
    tx.objectStore(CREDS_STORE).delete(endpoint)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  }))
}

function refreshUnreadBadge() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      try {
        client.postMessage({ type: 'COLLCT_UNREAD_REFRESH' })
      } catch { /* client gone */ }
    }
  }).catch(() => {})
}

function navigateToPath(url) {
  const targetUrl = new URL(url, self.registration.scope).href;
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
    const appClient = clientList.find((client) => {
      try {
        return new URL(client.url).origin === self.location.origin;
      } catch {
        return false;
      }
    });

    if (appClient) {
      // An app window is already open: navigate it in place. openWindow()
      // merely focuses the existing window without navigating (notably on
      // iOS), which silently drops the deep link.
      if ('navigate' in appClient) {
        try {
          const navigated = await appClient.navigate(targetUrl);
          return 'focus' in navigated ? navigated.focus() : undefined;
        } catch {
          // Fall through to focus + message below
        }
      }
      if ('focus' in appClient) {
        await appClient.focus();
      }
      // Ask the page to route itself (covers browsers without navigate()).
      // Post repeatedly: on a cold start the page may boot after the first
      // message, and a lost message means a dead tap. The app dedupes
      // repeat navigations. Awaited so the SW stays alive for delivery.
      if (typeof appClient.postMessage === 'function') {
        const message = { type: 'COLLCT_NAVIGATE', url }
        appClient.postMessage(message)
        await new Promise((resolve) => {
          setTimeout(() => {
            try { appClient.postMessage(message) } catch { /* client gone */ }
          }, 800)
          setTimeout(() => {
            try { appClient.postMessage(message) } catch { /* client gone */ }
            resolve()
          }, 2000)
        })
      }
      return undefined;
    }

    return self.clients.openWindow(targetUrl);
  });
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

  const isDwp = raw.web_push === 8030 && raw.notification

  // Always display manually, even for DWP payloads on DWP-capable browsers:
  // the OS replaces by tag (same tag = replacement, not stacking), while
  // skipping risks total silence if native display doesn't fire. Per API.md
  // service-worker requirements.
  if (isDwp) {
    event.waitUntil(
      showDwpNotification(raw.notification).then(() => refreshUnreadBadge()).catch(() => {})
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

function showDwpNotification(n) {
  const notificationData = n.data || {}

  return self.registration.showNotification(n.title || 'Collct', {
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
}

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
    }).then(async (subscription) => {
      console.log('[push] Re-registered subscription:', subscription.endpoint)

      // Look up credentials by the OLD endpoint (per-endpoint map supports
      // multi-account: each subscription reports to its own server).
      const oldEndpoint = event.oldSubscription?.endpoint || null
      const creds = oldEndpoint ? await getCredentials(oldEndpoint).catch(() => null) : null
      if (!creds?.serverUrl || !creds?.token) return

      // Migrate the record so future rotations keep resolving.
      await saveCredentials({ endpoint: subscription.endpoint, serverUrl: creds.serverUrl, token: creds.token }).catch(() => {})
      if (oldEndpoint && oldEndpoint !== subscription.endpoint) {
        await deleteCredentials(oldEndpoint).catch(() => {})
      }

      return fetch(`${creds.serverUrl}/api/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.token}`
        },
        body: JSON.stringify({ platform: 'web', ...subscription.toJSON() })
      }).catch((err) => {
        console.warn('[push] Failed to send re-subscription to server:', err)
      })
    }).catch((err) => {
      console.error('[push] Failed to re-register on subscription change:', err)
    })
  )
})
