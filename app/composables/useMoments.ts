interface MomentAccountState {
  accountId: string
  serverUrl: string
  supported: boolean
  state: MomentState | null
  lastFetched: number
}

const ACTIVE_POLL_MS = 5_000
const INACTIVE_POLL_MS = 30_000

export function useMoments() {
  const { accounts, activeAccountId } = useAccounts()

  const cache = useState<Record<string, MomentAccountState>>('collct-moments-cache', () => ({}))
  const activeDraft = ref<MomentDraft | null>(null)
  const allDrafts = ref<MomentDraft[]>([])

  let activeTimer: ReturnType<typeof setInterval> | null = null
  let inactiveTimer: ReturnType<typeof setInterval> | null = null

  async function fetchMomentState(account: CollctAccount): Promise<MomentAccountState> {
    try {
      const state = await $api<MomentState>('/api/moments/today', {
        serverUrl: account.serverUrl,
        token: account.token
      })
      return {
        accountId: account.id,
        serverUrl: account.serverUrl,
        supported: state.status !== 'disabled' || state.enabled,
        state,
        lastFetched: Date.now()
      }
    } catch {
      return {
        accountId: account.id,
        serverUrl: account.serverUrl,
        supported: false,
        state: null,
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

  function startInactivePolling() {
    stopInactivePolling()
    inactiveTimer = setInterval(() => {
      for (const acct of accounts.value) {
        if (acct.id !== activeAccountId.value) {
          refreshAccount(acct.id)
        }
      }
    }, INACTIVE_POLL_MS)
  }

  function stopInactivePolling() {
    if (inactiveTimer) {
      clearInterval(inactiveTimer)
      inactiveTimer = null
    }
  }

  async function loadDrafts() {
    if (!import.meta.client) return
    try {
      allDrafts.value = await momentDrafts.getAll()
    } catch {
      allDrafts.value = []
    }
  }

  async function saveDraft(draft: MomentDraft) {
    await momentDrafts.save(draft)
    activeDraft.value = draft
    if (!allDrafts.value.find(d => d.id === draft.id)) {
      allDrafts.value.push(draft)
    }
  }

  async function removeDraft(id: string) {
    await momentDrafts.remove(id)
    if (activeDraft.value?.id === id) {
      activeDraft.value = null
    }
    allDrafts.value = allDrafts.value.filter(d => d.id !== id)
  }

  async function retryAllDrafts() {
    const { activeAccount } = useAccounts()
    if (!activeAccount.value) return

    const acctDrafts = allDrafts.value.filter(
      d => d.accountId === activeAccount.value!.id && d.status !== 'retrying'
    )

    for (const draft of acctDrafts) {
      await updateDraft(draft.id, { status: 'retrying', attempts: draft.attempts + 1 })

      try {
        const compressed = await compressImage(draft.photo)
        const form = new FormData()
        form.append('photo', compressed)
        form.append('groupIds', JSON.stringify(draft.selectedGroupIds))
        form.append('isMoment', 'true')

        await $api<{ id: number }>('/api/photos', {
          method: 'post',
          body: form,
          serverUrl: draft.serverUrl,
          token: activeAccount.value.token
        })

        await removeDraft(draft.id)
      } catch {
        await updateDraft(draft.id, { status: 'failed', lastError: 'Upload failed' })
      }
    }
  }

  async function updateDraft(id: string, updates: Partial<MomentDraft>) {
    await momentDrafts.update(id, updates)
    const draft = allDrafts.value.find(d => d.id === id)
    if (draft) {
      Object.assign(draft, updates)
    }
    if (activeDraft.value?.id === id) {
      Object.assign(activeDraft.value, updates)
    }
  }

  const hasDrafts = computed(() => allDrafts.value.length > 0)

  const activeAccountDrafts = computed(() => {
    const id = activeAccountId.value
    if (!id) return []
    return allDrafts.value.filter(d => d.accountId === id)
  })

  function getStateForAccount(accountId: string) {
    return computed(() => cache.value[accountId] ?? null)
  }

  watch(activeAccountId, async (newId, oldId) => {
    if (oldId) stopActivePolling()
    if (newId) {
      await refreshActive()
      startActivePolling()
      activeDraft.value = allDrafts.value.find(d => d.accountId === newId) ?? null
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
    const onOnline = () => {
      if (allDrafts.value.length > 0) {
        retryAllDrafts()
      }
    }
    onMounted(() => {
      document.addEventListener('visibilitychange', onVisibilityChange)
      window.addEventListener('online', onOnline)
    })
    onUnmounted(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', onOnline)
    })
  }

  onMounted(async () => {
    await loadDrafts()
    if (allDrafts.value.length > 0) {
      retryAllDrafts()
    }
    await refreshActive()
    startActivePolling()
    startInactivePolling()
    if (activeAccountId.value) {
      activeDraft.value = allDrafts.value.find(d => d.accountId === activeAccountId.value) ?? null
    }
  })

  onUnmounted(() => {
    stopActivePolling()
    stopInactivePolling()
  })

  return {
    activeState,
    activeSupported,
    isActive,
    canCapture,
    remainingSeconds,
    activeDraft,
    allDrafts,
    hasDrafts,
    activeAccountDrafts,
    getStateForAccount,
    refreshActive,
    refreshAccount,
    saveDraft,
    removeDraft,
    updateDraft,
    retryAllDrafts,
    loadDrafts
  }
}
