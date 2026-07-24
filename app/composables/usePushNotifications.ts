export function usePushNotifications() {
  const api = useApi()
  const { activeAccount } = useAccounts()

  const DISMISS_KEY = 'collct-push-prompt-dismissed'
  const DISMISS_DAYS = 7

  const isSupported = computed(() => {
    return import.meta.client
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window
  })

  const isSubscribed = ref(false)
  const permission = ref<NotificationPermission>('default')
  const dismissed = ref(false)
  const vapidKey = ref<string | null>(null)

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
      const data = await $api<{ publicKey: string }>('/api/notifications/vapid-key')
      return data.publicKey
    } catch {
      return null
    }
  }

  async function requestPermission() {
    if (!isSupported.value || !vapidKey.value) return false

    const result = await Notification.requestPermission()
    permission.value = result

    if (result === 'granted') {
      await subscribe()
      return true
    }

    return false
  }

  async function subscribe() {
    if (!isSupported.value || !vapidKey.value) return

    permission.value = Notification.permission
    if (permission.value !== 'granted') return

    try {
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()

      if (existing) {
        isSubscribed.value = true
        return existing
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey.value)
      })

      await api.subscribePush(subscription.toJSON() as { endpoint: string, keys: { auth: string, p256dh: string } })

      isSubscribed.value = true
      return subscription
    } catch (err) {
      console.error('[push] Subscribe failed:', err)
    }
  }

  async function unsubscribe() {
    if (!isSupported.value) return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await api.unsubscribePush(subscription.endpoint)

        await subscription.unsubscribe()
        isSubscribed.value = false
      }
    } catch (err) {
      console.error('[push] Unsubscribe failed:', err)
    }
  }

  function dismissPrompt() {
    dismissed.value = true
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  }

  async function checkSubscription() {
    if (!isSupported.value) return
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      isSubscribed.value = !!subscription
      permission.value = Notification.permission
    } catch {
      // SW not ready yet
    }
  }

  async function init() {
    if (!import.meta.client || !activeAccount.value) return
    vapidKey.value = await fetchVapidKey()
    if ('Notification' in window) {
      permission.value = Notification.permission
    }
    await checkSubscription()
  }

  init()

  return {
    isSupported,
    isSubscribed,
    permission,
    shouldPrompt,
    vapidKey,
    subscribe,
    unsubscribe,
    requestPermission,
    dismissPrompt,
    checkSubscription
  }
}
