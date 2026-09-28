export type InstallVariant = 'prompt' | 'ios' | 'manual'

const DISMISS_KEY = 'collct-install-prompt-dismissed'

export function useAppInstall() {
  const { $pwa } = useNuxtApp()
  const { isNative, isPwa, isIos } = usePlatform()

  const dismissed = ref(import.meta.client && localStorage.getItem(DISMISS_KEY) === 'true')

  // Chromium fires beforeinstallprompt when the app is installable; the PWA
  // module surfaces it as $pwa.showInstallPrompt.
  const canPrompt = computed(() => !!$pwa?.showInstallPrompt)

  // Desktop Safari (Add to Dock) vs generic browser-menu guidance.
  const isSafariDesktop = computed(() => {
    if (!import.meta.client || isIos.value) return false
    const ua = navigator.userAgent
    return /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|SamsungBrowser/.test(ua)
  })

  const variant = computed<InstallVariant | null>(() => {
    if (!import.meta.client || dismissed.value) return null
    // Already installed, or already a native app — nothing to promote.
    if (isNative.value || isPwa.value) return null
    // Native install prompt (Chromium desktop/Android).
    if (canPrompt.value) return 'prompt'
    // iOS Safari: no prompt API exists — manual Add to Home Screen steps.
    // This is the only path to push notifications on iOS.
    if (isIos.value) return 'ios'
    // Desktop Safari/Firefox/Chromium that hasn't fired the event (yet).
    return 'manual'
  })

  const visible = computed(() => variant.value !== null)

  async function promptInstall(): Promise<void> {
    await $pwa?.install()
  }

  function dismiss(): void {
    dismissed.value = true
    if (import.meta.client) {
      localStorage.setItem(DISMISS_KEY, 'true')
    }
    // Also silence the module's own prompt machinery.
    $pwa?.cancelInstall()
  }

  return { variant, visible, isSafariDesktop, promptInstall, dismiss }
}
