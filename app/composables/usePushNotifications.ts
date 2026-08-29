type NotificationStatus = 'unsupported' | 'disabled' | 'pending' | 'active' | 'stale' | 'error'

const SUBSCRIPTION_STORAGE_PREFIX = 'collct-push-sub-'
const PUSH_SUBSCRIPTION_KEY = 'collct-push-subscription'
const DISMISS_KEY = 'collct-push-prompt-dismissed'
const DISMISS_DAYS = 7
const VALIDATE_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

export function usePushNotifications() {
  const api = useApi()
  const { activeAccount } = useAccounts()
  const { isNative } = usePlatform()

  const isSupported = computed(() => {
    if (isNative.value) return true
    return import.meta.client
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window
  })

  const isPwa = computed(() => {
    if (!import.meta.client || isNative.value) return false
    return navigator.standalone === true
      || window.matchMedia('(display-mode: standalone)').matches
  })

  const permission = ref<NotificationPermission>('default')
  const hasLocalSubscription = ref(false)
  const validating = ref(false)
  const vapidKey = ref<string | null>(null)
  const dismissed = ref(false)

  const notificationStatus = computed<NotificationStatus>(() => {
    if (!isSupported.value) return 'unsupported'
    if (permission.value === 'denied') return 'disabled'
    if (validating.value) return 'pending'
    if (hasLocalSubscription.value && permission.value === 'granted') return 'active'
    if (permission.value === 'granted' && !hasLocalSubscription.value) return 'stale'
    return 'pending'
  })

  const shouldPrompt = computed(() => {
    if (!isSupported.value || !vapidKey.value) return false
    if (permission.value === 'denied') return false
    if (permission.value === 'granted') return false
    if (dismissed.value) return false
    if (import.meta.client) {
      const stored = localStorage.getItem(DISMISS_KEY)
      if (stored) {
        const dismissedAt = Number(stored)
        const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
        if (daysSince < DISMISS_DAYS) return false
      }
    }
    return true
  })

  function getSubscriptionKey(): string {
    const acct = activeAccount.value
    if (!acct) return ''
    return `${SUBSCRIPTION_STORAGE_PREFIX}${acct.id}-${acct.serverUrl}`
  }

  function setSubscribedForAccount(value: boolean) {
    if (!import.meta.client) return
    const key = getSubscriptionKey()
    if (key) {
      if (value) {
        localStorage.setItem(key, 'true')
      } else {
        localStorage.removeItem(key)
      }
    }
  }

  function storeSwSubscriptionCredentials(endpoint: string) {
    if (!import.meta.client || !activeAccount.value) return
    try {
      localStorage.setItem(PUSH_SUBSCRIPTION_KEY, JSON.stringify({
        endpoint,
        serverUrl: activeAccount.value.serverUrl,
        token: activeAccount.value.token
      }))
    } catch {
      // Storage full or unavailable
    }
  }

  function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const buffer = new ArrayBuffer(rawData.length)
    const view = new Uint8Array(buffer)
    for (let i = 0; i < rawData.length; i++) {
      view[i] = rawData.charCodeAt(i)
    }
    return buffer
  }

  async function fetchVapidKey(): Promise<string | null> {
    try {
      const result = await api.getVapidPublicKey()
      return result.vapidPublicKey ?? null
    } catch {
      return null
    }
  }

  // --- Native (Capacitor) push ---

  async function subscribeNative(): Promise<boolean> {
    if (!activeAccount.value) return false

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const result = await PushNotifications.requestPermissions()
      if (result.display !== 'granted') {
        permission.value = 'denied'
        return false
      }

      permission.value = 'granted'
      await PushNotifications.register()

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false)
        }, 10000)

        PushNotifications.addListener('registration', (token) => {
          clearTimeout(timeout)
          hasLocalSubscription.value = true
          setSubscribedForAccount(true)
          api.subscribePush({ deviceToken: token.value }).catch(() => {})
          resolve(true)
        })

        PushNotifications.addListener('registrationError', () => {
          clearTimeout(timeout)
          hasLocalSubscription.value = false
          resolve(false)
        })
      })
    } catch {
      return false
    }
  }

  async function unsubscribeNative(): Promise<void> {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      await PushNotifications.removeAllListeners()
      await PushNotifications.unregister()
    } catch {
      // Ignore
    }
    hasLocalSubscription.value = false
    setSubscribedForAccount(false)
  }

  async function checkLocalSubscriptionNative() {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const permissions = await PushNotifications.checkPermissions()
      permission.value = permissions.display === 'granted' ? 'granted' : 'denied'

      if (permission.value === 'granted') {
        // Re-register to ensure token is current
        await PushNotifications.register()
      }
    } catch {
      // Ignore
    }
  }

  // --- Web push (existing logic) ---

  async function subscribe(): Promise<boolean> {
    if (!isSupported.value || !vapidKey.value) return false

    if (isNative.value) return subscribeNative()

    permission.value = Notification.permission
    if (permission.value !== 'granted') return false

    try {
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()

      if (existing) {
        try {
          await api.subscribePush(existing.toJSON() as { endpoint: string, keys: { auth: string, p256dh: string } })
          hasLocalSubscription.value = true
          setSubscribedForAccount(true)
          storeSwSubscriptionCredentials(existing.endpoint)
          return true
        } catch {
          await existing.unsubscribe()
        }
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey.value)
      })

      await api.subscribePush(subscription.toJSON() as { endpoint: string, keys: { auth: string, p256dh: string } })

      hasLocalSubscription.value = true
      setSubscribedForAccount(true)
      storeSwSubscriptionCredentials(subscription.endpoint)
      return true
    } catch (err) {
      console.error('[push] Subscribe failed:', err)
      hasLocalSubscription.value = false
      return false
    }
  }

  async function unsubscribe(): Promise<void> {
    if (!isSupported.value) return

    if (isNative.value) return unsubscribeNative()

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        try {
          await api.unsubscribePush(subscription.endpoint)
        } catch {
          // Server may not know about this subscription — continue with local cleanup
        }
        await subscription.unsubscribe()
      }

      hasLocalSubscription.value = false
      setSubscribedForAccount(false)
    } catch (err) {
      console.error('[push] Unsubscribe failed:', err)
    }
  }

  async function validateSubscription(): Promise<boolean> {
    if (!isSupported.value || !activeAccount.value) return false

    if (isNative.value) {
      await checkLocalSubscriptionNative()
      return hasLocalSubscription.value
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        hasLocalSubscription.value = false
        setSubscribedForAccount(false)
        return false
      }

      await api.subscribePush(subscription.toJSON() as { endpoint: string, keys: { auth: string, p256dh: string } })
      hasLocalSubscription.value = true
      setSubscribedForAccount(true)
      storeSwSubscriptionCredentials(subscription.endpoint)
      return true
    } catch {
      return false
    }
  }

  async function recoverStaleSubscription(): Promise<boolean> {
    if (!isSupported.value || !vapidKey.value) return false

    if (isNative.value) return subscribeNative()

    validating.value = true
    try {
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()

      if (existing) {
        await existing.unsubscribe().catch(() => {})
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey.value)
      })

      await api.subscribePush(subscription.toJSON() as { endpoint: string, keys: { auth: string, p256dh: string } })

      hasLocalSubscription.value = true
      setSubscribedForAccount(true)
      storeSwSubscriptionCredentials(subscription.endpoint)
      return true
    } catch (err) {
      console.error('[push] Recovery failed:', err)
      hasLocalSubscription.value = false
      setSubscribedForAccount(false)
      return false
    } finally {
      validating.value = false
    }
  }

  async function requestPermission(): Promise<boolean> {
    if (!isSupported.value) return false

    if (isNative.value) return subscribeNative()

    const result = await Notification.requestPermission()
    permission.value = result

    if (result === 'granted') {
      if (!vapidKey.value) {
        vapidKey.value = await fetchVapidKey()
      }
      if (vapidKey.value) {
        return await subscribe()
      }
      return false
    }

    return false
  }

  async function retry(): Promise<boolean> {
    if (!vapidKey.value) {
      vapidKey.value = await fetchVapidKey()
    }
    if (!vapidKey.value) return false
    return await recoverStaleSubscription()
  }

  function dismissPrompt() {
    dismissed.value = true
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  }

  async function checkLocalSubscription() {
    if (!isSupported.value) return

    if (isNative.value) return checkLocalSubscriptionNative()

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      hasLocalSubscription.value = !!subscription
      permission.value = Notification.permission
      if (subscription) {
        storeSwSubscriptionCredentials(subscription.endpoint)
      }
    } catch {
      // SW not ready yet
    }
  }

  async function init() {
    if (!import.meta.client || !activeAccount.value) return

    if (isNative.value) {
      await checkLocalSubscriptionNative()
      // Native push doesn't need VAPID — set to placeholder so shouldPrompt works
      vapidKey.value = 'native'
      return
    }

    vapidKey.value = await fetchVapidKey()
    if ('Notification' in window) {
      permission.value = Notification.permission
    }
    await checkLocalSubscription()
  }

  async function onForeground() {
    if (!import.meta.client || document.hidden) return
    if (!activeAccount.value || !isSupported.value) return

    await checkLocalSubscription()

    if (permission.value === 'granted') {
      const valid = await validateSubscription()
      if (!valid && permission.value === 'granted') {
        if (!vapidKey.value) {
          vapidKey.value = await fetchVapidKey()
        }
        if (vapidKey.value) {
          await recoverStaleSubscription()
        }
      }
    }
  }

  let validateTimer: ReturnType<typeof setInterval> | null = null

  init()

  if (import.meta.client) {
    if (isNative.value) {
      // Listen for foreground notification taps on native
      import('@capacitor/push-notifications').then(({ PushNotifications }) => {
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          const data = notification.notification.data
          if (data?.navigate) {
            navigateTo(data.navigate)
          }
        })
      })

      import('@capacitor/app').then(({ App }) => {
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) onForeground()
        })
      })
    } else {
      document.addEventListener('visibilitychange', onForeground)
      validateTimer = setInterval(() => {
        if (!document.hidden && activeAccount.value && isSupported.value) {
          onForeground()
        }
      }, VALIDATE_INTERVAL_MS)
    }
  }

  onUnmounted(() => {
    if (import.meta.client && !isNative.value) {
      document.removeEventListener('visibilitychange', onForeground)
      if (validateTimer) {
        clearInterval(validateTimer)
        validateTimer = null
      }
    }
  })

  return {
    isSupported,
    isPwa,
    permission,
    notificationStatus,
    hasLocalSubscription,
    shouldPrompt,
    vapidKey,
    subscribe,
    unsubscribe,
    requestPermission,
    retry,
    dismissPrompt,
    checkLocalSubscription
  }
}
