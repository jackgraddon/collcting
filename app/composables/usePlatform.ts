type PlatformType = 'web' | 'apns' | 'fcm'

export function usePlatform() {
  const isNative = computed(() => {
    if (!import.meta.client) return false
    return !!(window as unknown as Record<string, unknown>).Capacitor
  })

  const isWeb = computed(() => !isNative.value)

  const isPwa = computed(() => {
    if (!import.meta.client || isNative.value) return false
    return (navigator as Navigator & { standalone?: boolean }).standalone === true
      || window.matchMedia('(display-mode: standalone)').matches
  })

  const isIos = computed(() => {
    if (!import.meta.client) return false
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  })

  const platform = computed<PlatformType>(() => {
    if (!import.meta.client || !isNative.value) return 'web'

    const Capacitor = (window as unknown as Record<string, unknown>).Capacitor as Record<string, unknown> | undefined
    const getPlatform = Capacitor?.getPlatform as (() => string) | undefined
    if (getPlatform) {
      const p = getPlatform()
      if (p === 'ios') return 'apns'
      if (p === 'android') return 'fcm'
    }

    return 'web'
  })

  return { isNative, isWeb, platform, isPwa, isIos }
}
