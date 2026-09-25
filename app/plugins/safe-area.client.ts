// Safe-area resolver: measures the real env() insets and writes them to
// --safe-area-* on :root, working around WebKit bug #301994 (env() returns 0
// in iOS standalone PWA mode — still REOPENED as of iOS 27).
//
// Why JS instead of pure CSS:
// - `@media (display-mode: standalone)` is unreliable (may not match in a real
//   installed PWA), while `navigator.standalone` is the dependable iOS signal.
// - env() also lies transiently (0 on cold start, resets after client-side
//   navigation), so a one-time CSS value can't recover — this re-runs on route
//   change, resize, and orientation change.
// - When env() is 0, two opposite variants need opposite treatment (opaque
//   system bar already offsets the viewport → pad 0; transparent overlay → pad
//   the fallback), which static CSS cannot distinguish.
//
// Probe-first ordering means an Apple fix changes nothing: real values flow
// straight through. `.client.ts` suffix keeps this out of SSR/prerender.

type Edge = 'top' | 'right' | 'bottom' | 'left'

interface SafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
}

// Dynamic Island iPhone fallback (test device class).
const FALLBACK_PORTRAIT: SafeAreaInsets = { top: 59, right: 0, bottom: 34, left: 0 }
const FALLBACK_LANDSCAPE: SafeAreaInsets = { top: 0, right: 47, bottom: 21, left: 47 }

function isNativeApp(): boolean {
  return typeof (window as unknown as Record<string, unknown>).Capacitor !== 'undefined'
}

function isIosStandalone(): boolean {
  if (typeof navigator === 'undefined') return false
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function keyboardOpen(): boolean {
  const el = document.activeElement
  if (!el) return false
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  return el instanceof HTMLElement && el.isContentEditable
}

// getComputedStyle can return the literal "env(...)" string instead of a
// resolved value (WebKit #274773) — a probe element's offset size is reliable.
function measureEdge(prop: Edge): number {
  const el = document.createElement('div')
  const horizontal = prop === 'left' || prop === 'right'
  el.style.cssText = `position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-${prop}:env(safe-area-inset-${prop}, 0px)`
  document.body.appendChild(el)
  const value = horizontal ? el.offsetWidth : el.offsetHeight
  el.remove()
  return value
}

function resolveInsets(): SafeAreaInsets {
  const measured: SafeAreaInsets = {
    top: measureEdge('top'),
    right: measureEdge('right'),
    bottom: measureEdge('bottom'),
    left: measureEdge('left')
  }

  // Bug absent (or not an affected context): trust the platform values.
  if (!isIosStandalone() || isNativeApp()) return measured

  const vv = window.visualViewport
  const gapH = window.screen.height - (vv?.height ?? window.innerHeight)
  const portrait = window.innerHeight >= window.innerWidth
  const fallback = portrait ? FALLBACK_PORTRAIT : FALLBACK_LANDSCAPE

  // The gap rule applies to the top edge only: the system bar (when opaque)
  // occupies the top, but the home indicator still needs its bottom pad and
  // landscape sides are unaffected — those always take the table fallback.
  const gapIsSystemBar = portrait && gapH > 40
  const resolved: SafeAreaInsets = {
    top: measured.top > 0 ? measured.top : (gapIsSystemBar ? 0 : fallback.top),
    right: measured.right > 0 ? measured.right : fallback.right,
    bottom: measured.bottom > 0 ? measured.bottom : fallback.bottom,
    left: measured.left > 0 ? measured.left : fallback.left
  }

  if (import.meta.dev) {
    console.debug('[safe-area]', {
      measured,
      gapH: Math.round(gapH),
      portrait,
      standalone: true,
      applied: resolved
    })
  }

  return resolved
}

function applyInsets(): void {
  if (keyboardOpen()) return
  const insets = resolveInsets()
  const root = document.documentElement
  root.style.setProperty('--safe-area-top', `${insets.top}px`)
  root.style.setProperty('--safe-area-right', `${insets.right}px`)
  root.style.setProperty('--safe-area-bottom', `${insets.bottom}px`)
  root.style.setProperty('--safe-area-left', `${insets.left}px`)
}

export default defineNuxtPlugin((nuxtApp) => {
  applyInsets()
  nuxtApp.hook('page:finish', () => applyInsets())
  window.addEventListener('resize', () => applyInsets())
  window.addEventListener('orientationchange', () => applyInsets())
})
