import type { Ref } from 'vue'

const POLL_INTERVAL = 10_000

export function useFeedPolling() {
  const api = useApi()

  const photos = ref<PostData[]>([]) as Ref<PostData[]>
  const nextCursor = ref<number | null>(null)
  const isLoading = ref(true)
  const isPolling = ref(false)

  let pollTimer: ReturnType<typeof setInterval> | null = null

  function mergeFeed(incoming: PostData[], existing: PostData[]): PostData[] {
    const existingMap = new Map(existing.map(p => [p.id, p]))

    const updated = incoming.map((p) => {
      const local = existingMap.get(p.id)
      return local ? { ...local, ...p } : p
    })

    const incomingIds = new Set(incoming.map(p => p.id))
    const carried = existing.filter(p => !incomingIds.has(p.id))

    return [...updated, ...carried]
  }

  async function fetchFeed(opts?: { limit?: number, before?: number, after?: number }) {
    const limit = opts?.limit ?? 20
    try {
      const result = await api.getFeed({ limit, before: opts?.before, after: opts?.after })
      return result
    } catch {
      return null
    }
  }

  async function loadInitial() {
    isLoading.value = true
    try {
      const result = await fetchFeed({ limit: 20 })
      if (result) {
        photos.value = result.photos
        nextCursor.value = result.nextCursor
      }
    } finally {
      isLoading.value = false
    }
  }

  async function poll() {
    const result = await fetchFeed({ limit: 20 })
    if (!result) return

    photos.value = mergeFeed(result.photos, photos.value)
    nextCursor.value = result.nextCursor
  }

  async function loadMore() {
    if (!nextCursor.value) return
    const result = await fetchFeed({ limit: 20, before: nextCursor.value })
    if (!result) return

    photos.value = [...photos.value, ...result.photos]
    nextCursor.value = result.nextCursor
  }

  async function refresh() {
    const result = await fetchFeed({ limit: 20 })
    if (!result) return
    photos.value = result.photos
    nextCursor.value = result.nextCursor
  }

  function startPolling() {
    if (pollTimer) return
    isPolling.value = true
    pollTimer = setInterval(poll, POLL_INTERVAL)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    isPolling.value = false
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stopPolling()
    } else {
      poll()
      startPolling()
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    stopPolling()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return {
    photos,
    nextCursor,
    isLoading,
    isPolling,
    loadInitial,
    loadMore,
    refresh,
    startPolling,
    stopPolling
  }
}
