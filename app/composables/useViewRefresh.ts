// Refresh-on-revisit with per-view cooldown. Pages fetch on setup (fresh
// mount); keepalive revives and foreground returns don't rerun setup, so this
// covers those paths. Cooldown prevents refetch storms when tabbing quickly.
const lastRefreshAt = useState<Record<string, number>>('view-refresh-at', () => ({}))

export function useViewRefresh(key: string, refresh: () => Promise<unknown> | unknown, cooldownMs = 15000) {
  async function maybeRefresh(force = false) {
    const now = Date.now()
    if (!force && now - (lastRefreshAt.value[key] ?? 0) < cooldownMs) return
    lastRefreshAt.value[key] = now
    try {
      await refresh()
    } catch {
      // Offline — keep stale content
    }
  }

  // First activation follows the initial mount (which already fetched).
  let firstActivation = true
  onActivated(() => {
    if (firstActivation) {
      firstActivation = false
      return
    }
    maybeRefresh()
  })

  if (import.meta.client) {
    const onVisibilityChange = () => {
      if (!document.hidden) maybeRefresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    onUnmounted(() => document.removeEventListener('visibilitychange', onVisibilityChange))
  }

  return { refreshView: () => maybeRefresh(true) }
}
