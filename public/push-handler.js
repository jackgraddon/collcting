// Push notification handler — imported into the Workbox-generated service worker
// via workbox.importScripts in nuxt.config.ts

const TAG_PREFIX = 'collct-'
const shownNotifications = new Map()
const ACCOUNT_STORAGE_PREFIX = 'collct-push-account-'

self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[push] Received push event with no data')
    return
  }

  let data
  try {
    data = event.data.json()
  } catch (err) {
    console.warn('[push] Failed to parse push data as JSON, using text fallback:', err)
    try {
      data = { title: 'Collct', body: event.data.text() }
    } catch (textErr) {
      console.error('[push] Failed to read push data as text:', textErr)
      data = { title: 'Collct', body: 'You have a new notification' }
    }
  }

  const type = data.data?.type || data.type || 'notification'
  const fallbackBody = type === 'group_invite'
    ? 'invited you to a group'
    : type === 'like'
      ? 'liked your photo'
      : type === 'comment'
        ? 'commented on your photo'
        : type === 'moment'
          ? 'Your moment is ready!'
          : type === 'group_join'
            ? 'joined a group'
            : type === 'new_post'
              ? 'posted a new photo'
              : 'interacted with your content'

  const tag = data.tag || `${TAG_PREFIX}${type}`

  const options = {
    body: data.body || fallbackBody,
    icon: data.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag,
    data: data.data || {},
  }

  const now = Date.now()
  const lastShown = shownNotifications.get(tag)
  if (lastShown && now - lastShown < 5000) {
    console.log(`[push] Dedup: skipping duplicate notification with tag "${tag}"`)
    return
  }
  shownNotifications.set(tag, now)

  event.waitUntil(
    self.registration.showNotification(data.title || 'Collct', options).catch((err) => {
      console.error('[push] Failed to show notification:', err)
    }).then(() => {
      if (data.serverUrl && data.token) {
        localStorage.setItem(`${ACCOUNT_STORAGE_PREFIX}active`, JSON.stringify({
          serverUrl: data.serverUrl,
          token: data.token
        }))
      }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data || {}
  let url = '/'

  if (data.type === 'moment') {
    url = '/?moment=capture'
  } else if (data.photoId) {
    url = `/post/${data.photoId}`
  } else if (data.groupId) {
    url = `/groups/${data.groupId}`
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus()
          client.navigate(url).catch((err) => {
            console.error('[push] Failed to navigate:', err)
            client.navigate('/')
          })
          return
        }
      }
      return self.clients.openWindow(url).catch((err) => {
        console.error('[push] Failed to open window:', err)
      })
    }).catch((err) => {
      console.error('[push] Failed to match clients:', err)
      return self.clients.openWindow(url).catch((openErr) => {
        console.error('[push] Failed to open window as fallback:', openErr)
      })
    })
  )
})

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {}
  const notificationId = data.notificationId

  if (!notificationId) {
    return
  }

  const stored = localStorage.getItem(`${ACCOUNT_STORAGE_PREFIX}active`)
  if (!stored) {
    return
  }

  try {
    const { serverUrl, token } = JSON.parse(stored)
    if (!serverUrl || !token) return

    event.waitUntil(
      fetch(`${serverUrl}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }).catch((err) => {
        console.error('[push] Failed to dismiss notification:', err)
      })
    )
  } catch (err) {
    console.error('[push] Failed to parse stored credentials:', err)
  }
})

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[push] Subscription changed, re-registering...')
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription?.options || { userVisibleOnly: true }).then((subscription) => {
      console.log('[push] Re-registered subscription:', subscription.endpoint)
    }).catch((err) => {
      console.error('[push] Failed to re-register on subscription change:', err)
    })
  )
})
