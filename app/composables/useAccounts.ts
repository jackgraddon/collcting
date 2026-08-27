const STORAGE_KEY = 'collct_accounts'
const ACTIVE_KEY = 'collct_active_account'
const PUSH_SUB_KEY_PREFIX = 'collct-push-sub-'

export function useAccounts() {
  const accounts = useState<CollctAccount[]>('collct-accounts', () => [])
  const activeAccountId = useState<string | null>('collct-active-account', () => null)
  const loaded = useState('collct-accounts-loaded', () => false)

  function load() {
    if (loaded.value) return
    if (import.meta.server) return

    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        accounts.value = JSON.parse(raw)
      }
      const activeId = localStorage.getItem(ACTIVE_KEY)
      if (activeId && accounts.value.some(a => a.id === activeId)) {
        activeAccountId.value = activeId
      } else if (accounts.value.length > 0) {
        activeAccountId.value = accounts.value[0]!.id
      }
    } catch {
      accounts.value = []
    }
    loaded.value = true
  }

  function save() {
    if (import.meta.server) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts.value))
    if (activeAccountId.value) {
      localStorage.setItem(ACTIVE_KEY, activeAccountId.value)
    }
  }

  const activeAccount = computed(() => {
    return accounts.value.find(a => a.id === activeAccountId.value) ?? null
  })

  function addAccount(account: CollctAccount) {
    accounts.value.push(account)
    if (!activeAccountId.value) {
      activeAccountId.value = account.id
    }
    save()
  }

  function removeAccount(id: string) {
    const account = accounts.value.find(a => a.id === id)
    accounts.value = accounts.value.filter(a => a.id !== id)
    if (activeAccountId.value === id) {
      activeAccountId.value = accounts.value[0]?.id ?? null
    }
    if (account && import.meta.client) {
      try {
        localStorage.removeItem(`${PUSH_SUB_KEY_PREFIX}${account.id}-${account.serverUrl}`)
      } catch {
        // Ignore
      }
    }
    save()
  }

  function updateAccount(id: string, updates: Partial<CollctAccount>) {
    const account = accounts.value.find(a => a.id === id)
    if (account) {
      Object.assign(account, updates)
      save()
    }
  }

  function switchAccount(id: string) {
    if (accounts.value.some(a => a.id === id)) {
      activeAccountId.value = id
      save()
    }
  }

  async function testConnection(serverUrl: string, token: string): Promise<AccountUser | null> {
    try {
      const res = await $fetch<{ id: number, name: string, username: string, avatarUrl: string | null }>('/api/user/me', {
        baseURL: serverUrl,
        headers: { Authorization: `Bearer ${token}` }
      })
      return {
        id: res.id,
        name: res.name,
        username: res.username,
        avatarUrl: res.avatarUrl
      }
    } catch {
      return null
    }
  }

  async function requestAuthorization(serverUrl: string, appName = 'Collct') {
    return $fetch<{
      authorize_url: string
      code: string
      state?: string
    }>('/api/auth/authorize', {
      baseURL: serverUrl,
      method: 'post',
      body: {
        redirect_uri: window.location.origin + '/login',
        app_name: appName
      }
    })
  }

  async function exchangeToken(serverUrl: string, code: string) {
    return $fetch<{
      access_token: string
      token_type: string
      expires_in: number | null
    }>('/api/auth/token', {
      baseURL: serverUrl,
      method: 'post',
      body: { code }
    })
  }

  // Load on first use
  load()

  return {
    accounts: readonly(accounts),
    activeAccountId: readonly(activeAccountId),
    activeAccount,
    loaded: readonly(loaded),
    addAccount,
    removeAccount,
    updateAccount,
    switchAccount,
    testConnection,
    requestAuthorization,
    exchangeToken
  }
}
