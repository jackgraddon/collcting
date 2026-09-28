export type PushSubscriptionStatus = 'unsupported' | 'denied' | 'off' | 'on' | 'error'
export type PushDisplayMethod = 'dwp' | 'sw'

const SUBSCRIPTION_STORAGE_PREFIX = 'collct-push-sub-'
const DISMISS_KEY = 'collct-push-prompt-dismissed'
const DISMISS_DAYS = 7
const VALIDATE_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes
const DWP_FLAG_KEY = 'dwp-native-display'

function isIosDevice(): boolean {
  if (!import.meta.client) return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// Declarative Web Push renders natively only in Safari 18.4+. Everywhere
// else (Chrome, Firefox, older Safari) the service worker must display
// manually — defaulting to manual is the only safe fallback, since skipping
// on a non-DWP browser would swallow the notification silently.
function detectDwpNativeDisplay(): boolean {
  if (!import.meta.client) return false
  const ua = navigator.userAgent
  if (/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|SamsungBrowser/.test(ua)) return false
  const match = ua.match(/Version\/(\d+)(?:\.(\d+))?/)
  if (!match) return false
  const major = Number(match[1])
  const minor = Number(match[2] ?? 0)
  return major > 18 || (major === 18 && minor >= 4)
}

export function usePushSubscription() {
  const api = useApi()
  const { activeAccount, activeAccountId } = useAccounts()
  const { isNative, isPwa } = usePlatform()

  const isSupported = computed(() => {
    if (!import.meta.client || isNative.value) return false
    // iOS only delivers web push to installed PWAs — a Safari tab can never
    // subscribe, so report unsupported (with install guidance) instead of
    // failing later with an error/retry loop.
    if (isIosDevice() && !isPwa.value) return false
    return 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window
  })

  const permission = ref<NotificationPermission>('default')
  const hasLocalSubscription = ref(false)
  const method = ref<PushDisplayMethod | null>(null)
  const busy = ref(false)
  const failed = ref(false)
  const dismissed = ref(false)
  const vapidKey = ref<string | null>(null)

  const status = computed<PushSubscriptionStatus>(() => {
    if (!isSupported.value) return 'unsupported'
    if (permission.value === 'denied') return 'denied'
    if (failed.value) return 'error'
    if (hasLocalSubscription.value && permission.value === 'granted') return 'on'
    return 'off'
  })

  const shouldPrompt = computed(() => {
    if (!isSupported.value || !vapidKey.value) return false
    if (permission.value !== 'default') return false
    if (hasLocalSubscription.value || dismissed.value) return false
    if (import.meta.client) {
      const stored = localStorage.getItem(DISMISS_KEY)
      if (stored) {
        const daysSince = (Date.now() - Number(stored)) / (1000 * 60 * 60 * 24)
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
    if (!key) return
    if (value) {
      localStorage.setItem(key, 'true')
    } else {
      localStorage.removeItem(key)
    }
  }

  function storeCredentials(endpoint: string) {
    if (!import.meta.client || !activeAccount.value) return
    pushCredentials.save({
      endpoint,
      serverUrl: activeAccount.value.serverUrl,
      token: activeAccount.value.token
    }).catch(() => {
      // Storage unavailable — SW re-subscribe reporting degrades gracefully
    })
  }

  async function storeDisplayMethod(): Promise<PushDisplayMethod> {
    const dwp = detectDwpNativeDisplay()
    method.value = dwp ? 'dwp' : 'sw'
    await pushCredentials.setMeta(DWP_FLAG_KEY, dwp).catch(() => {})
    return method.value
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

  function webSubscriptionPayload(subscription: PushSubscription) {
    return {
      platform: 'web' as const,
      ...(subscription.toJSON() as { endpoint: string, keys: { auth: string, p256dh: string } })
    }
  }

  async function subscribe(): Promise<boolean> {
    if (!isSupported.value || busy.value) return false
    busy.value = true
    failed.value = false
    try {
      if (!vapidKey.value) vapidKey.value = await fetchVapidKey()
      if (!vapidKey.value) {
        failed.value = true
        return false
      }

      // The only place permission is ever requested — always from an explicit
      // user gesture (settings toggle / prompt banner).
      permission.value = await Notification.requestPermission()
      if (permission.value !== 'granted') return false

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey.value)
        })
      }

      try {
        await api.subscribePush(webSubscriptionPayload(subscription))
      } catch {
        // Stale local subscription — replace it once, then report.
        await subscription.unsubscribe().catch(() => {})
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey.value)
        })
        await api.subscribePush(webSubscriptionPayload(subscription))
      }

      hasLocalSubscription.value = true
      setSubscribedForAccount(true)
      storeCredentials(subscription.endpoint)
      await storeDisplayMethod()
      return true
    } catch (err) {
      console.error('[push] Subscribe failed:', err)
      hasLocalSubscription.value = false
      failed.value = true
      return false
    } finally {
      busy.value = false
    }
  }

  async function unsubscribe(): Promise<void> {
    if (busy.value) return
    busy.value = true
    try {
      if (isSupported.value) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          try {
            await api.unsubscribePush(subscription.endpoint)
          } catch {
            // Server may not know about this subscription — continue locally
          }
          await subscription.unsubscribe()
        }
      }
    } catch (err) {
      console.error('[push] Unsubscribe failed:', err)
    } finally {
      hasLocalSubscription.value = false
      method.value = null
      setSubscribedForAccount(false)
      busy.value = false
    }
  }

  // Silent maintenance: keeps the server registration fresh without ever
  // prompting. Runs on init, foreground, interval, and account switch.
  async function refresh(): Promise<void> {
    if (!import.meta.client || !activeAccount.value || !isSupported.value) return
    try {
      if (!vapidKey.value) vapidKey.value = await fetchVapidKey()
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      permission.value = Notification.permission
      if (!subscription) {
        hasLocalSubscription.value = false
        method.value = null
        setSubscribedForAccount(false)
        return
      }
      await api.subscribePush(webSubscriptionPayload(subscription))
      hasLocalSubscription.value = true
      setSubscribedForAccount(true)
      storeCredentials(subscription.endpoint)
      await storeDisplayMethod()
    } catch {
      // Offline or SW not ready — keep last known state
    }
  }

  async function init() {
    if (!import.meta.client || !activeAccount.value) return
    failed.value = false
    await refresh()
  }

  function dismissPrompt() {
    dismissed.value = true
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  }

  init()

  if (import.meta.client) {
    const onVisibilityChange = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    const validateTimer = setInterval(() => {
      if (!document.hidden && activeAccount.value && isSupported.value) refresh()
    }, VALIDATE_INTERVAL_MS)
    watch(activeAccountId, () => init())
    onUnmounted(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(validateTimer)
    })
  }

  return {
    status,
    permission,
    method,
    isSupported,
    busy,
    shouldPrompt,
    subscribe,
    unsubscribe,
    refresh,
    dismissPrompt
  }
}
