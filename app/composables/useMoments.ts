interface MomentCache {
  accountId: string
  state: MomentState | null
  supported: boolean
  lastFetched: number
}

const ACTIVE_POLL_MS = 30_000
const BACKGROUND_POLL_MS = 30 * 60_000

export function useMoments() {
  const { accounts, activeAccountId } = useAccounts()

  const cache = useState<Record<string, MomentCache>>('collct-moments-cache', () => ({}))

  let activeTimer: ReturnType<typeof setInterval> | null = null
  let backgroundTimer: ReturnType<typeof setInterval> | null = null

  async function fetchMomentState(account: CollctAccount): Promise<MomentCache> {
    try {
      const state = await $api<MomentState>('/api/moments/today', {
        serverUrl: account.serverUrl,
        token: account.token
      })
      return {
        accountId: account.id,
        state,
        supported: true,
        lastFetched: Date.now()
      }
    } catch {
      return {
        accountId: account.id,
        state: null,
        supported: false,
        lastFetched: Date.now()
      }
    }
  }

  const activeMoment = computed(() => {
    const id = activeAccountId.value
    if (!id) return null
    return cache.value[id] ?? null
  })

  const activeSupported = computed(() => activeMoment.value?.supported ?? false)
  const activeState = computed(() => activeMoment.value?.state ?? null)
  const isActive = computed(() => activeState.value?.status === 'active')
  const canCapture = computed(() => isActive.value && !activeState.value?.capturedToday)

  const remainingSeconds = computed(() => {
    const s = activeState.value
    if (!s?.momentTime || s.status !== 'active') return 0
    const end = new Date(s.momentTime).getTime() + s.captureDuration * 1000
    return Math.max(0, Math.ceil((end - Date.now()) / 1000))
  })

  async function refreshActive() {
    const acct = accounts.value.find(a => a.id === activeAccountId.value)
    if (!acct) return
    const result = await fetchMomentState(acct)
    cache.value = { ...cache.value, [acct.id]: result }
  }

  async function refreshAccount(accountId: string) {
    const acct = accounts.value.find(a => a.id === accountId)
    if (!acct || accountId === activeAccountId.value) return
    const result = await fetchMomentState(acct)
    cache.value = { ...cache.value, [acct.id]: result }
  }

  function startActivePolling() {
    stopActivePolling()
    refreshActive()
    activeTimer = setInterval(refreshActive, ACTIVE_POLL_MS)
  }

  function stopActivePolling() {
    if (activeTimer) {
      clearInterval(activeTimer)
      activeTimer = null
    }
  }

  function startBackgroundPolling() {
    stopBackgroundPolling()
    backgroundTimer = setInterval(() => {
      for (const acct of accounts.value) {
        if (acct.id !== activeAccountId.value) {
          refreshAccount(acct.id)
        }
      }
    }, BACKGROUND_POLL_MS)
  }

  function stopBackgroundPolling() {
    if (backgroundTimer) {
      clearInterval(backgroundTimer)
      backgroundTimer = null
    }
  }

  watch(activeAccountId, async (newId, oldId) => {
    if (oldId) stopActivePolling()
    if (newId) {
      await refreshActive()
      startActivePolling()
    }
  })

  if (import.meta.client) {
    const onVisibilityChange = () => {
      if (!document.hidden) {
        refreshActive()
        for (const acct of accounts.value) {
          if (acct.id !== activeAccountId.value) {
            refreshAccount(acct.id)
          }
        }
      }
    }
    onMounted(() => document.addEventListener('visibilitychange', onVisibilityChange))
    onUnmounted(() => document.removeEventListener('visibilitychange', onVisibilityChange))
  }

  onMounted(async () => {
    await refreshActive()
    startActivePolling()
    startBackgroundPolling()
  })

  onUnmounted(() => {
    stopActivePolling()
    stopBackgroundPolling()
  })

  function getStateForAccount(accountId: string) {
    return computed(() => cache.value[accountId] ?? null)
  }

  return {
    activeState,
    activeSupported,
    isActive,
    canCapture,
    remainingSeconds,
    getStateForAccount,
    refreshActive,
    refreshAccount
  }
}
