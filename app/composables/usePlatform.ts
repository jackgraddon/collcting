type PlatformType = 'web' | 'apns' | 'fcm'

export function usePlatform() {
  const isNative = computed(() => {
    if (!import.meta.client) return false
    return !!(window as Record<string, unknown>).Capacitor
  })

  const isWeb = computed(() => !isNative.value)

  const platform = computed<PlatformType>(() => {
    if (!import.meta.client || !isNative.value) return 'web'

    const Capacitor = (window as Record<string, unknown>).Capacitor as Record<string, unknown> | undefined
    const getPlatform = Capacitor?.getPlatform as (() => string) | undefined
    if (getPlatform) {
      const p = getPlatform()
      if (p === 'ios') return 'apns'
      if (p === 'android') return 'fcm'
    }

    return 'web'
  })

  return { isNative, isWeb, platform }
}
