const STORAGE_KEY = 'collct_accounts'
const ACTIVE_KEY = 'collct_active_account'
const PUSH_SUB_KEY_PREFIX = 'collct-push-sub-'
const HEARTBEAT_KEY = 'collct_last_active'
const CORRUPT_BACKUP_KEY = 'collct_accounts.corrupt'

export type AccountStorageStatus = 'unknown' | 'ok' | 'empty' | 'blocked' | 'corrupt'

export function useAccounts() {
  const accounts = useState<CollctAccount[]>('collct-accounts', () => [])
  const activeAccountId = useState<string | null>('collct-active-account', () => null)
  const loaded = useState('collct-accounts-loaded', () => false)
  const storageStatus = useState<AccountStorageStatus>('collct-accounts-storage', () => 'unknown')
  const lastActiveAt = useState<number | null>('collct-last-active-at', () => null)
  const corruptBackupFound = useState('collct-accounts-corrupt', () => false)

  function load() {
    if (loaded.value) return
    if (import.meta.server) return

    // Launch heartbeat — the forensic discriminator for "logged out overnight":
    // a missing morning heartbeat means storage was wiped; heartbeat without
    // accounts means selective loss; both present means an app-level issue.
    const prevHeartbeat = storageGet(HEARTBEAT_KEY)
    lastActiveAt.value = prevHeartbeat ? Number(prevHeartbeat) || null : null
    storageSet(HEARTBEAT_KEY, String(Date.now()))

    if (!storageAvailable()) {
      storageStatus.value = 'blocked'
      loaded.value = true
      return
    }

    const { readable, value: raw } = storageRead(STORAGE_KEY)
    if (!readable) {
      storageStatus.value = 'blocked'
      loaded.value = true
      return
    }

    if (!raw) {
      storageStatus.value = 'empty'
      loaded.value = true
      return
    }

    try {
      accounts.value = JSON.parse(raw)
      const activeId = storageGet(ACTIVE_KEY)
      if (activeId && accounts.value.some(a => a.id === activeId)) {
        activeAccountId.value = activeId
      } else if (accounts.value.length > 0) {
        activeAccountId.value = accounts.value[0]!.id
      }
      storageStatus.value = 'ok'
    } catch {
      // Don't discard evidence: back the corrupt blob up (single slot) so a
      // future diagnosis can inspect it, then start empty with a visible flag.
      storageSet(CORRUPT_BACKUP_KEY, raw)
      corruptBackupFound.value = true
      accounts.value = []
      storageStatus.value = 'corrupt'
    }
    loaded.value = true
  }

  function save(): boolean {
    if (import.meta.server) return false
    const okAccounts = storageSet(STORAGE_KEY, JSON.stringify(accounts.value))
    let okActive = true
    if (activeAccountId.value) {
      okActive = storageSet(ACTIVE_KEY, activeAccountId.value)
    }
    return okAccounts && okActive
  }

  const activeAccount = computed(() => {
    return accounts.value.find(a => a.id === activeAccountId.value) ?? null
  })

  function addAccount(account: CollctAccount): boolean {
    accounts.value.push(account)
    if (!activeAccountId.value) {
      activeAccountId.value = account.id
    }
    return save()
  }

  function removeAccount(id: string): boolean {
    const account = accounts.value.find(a => a.id === id)
    accounts.value = accounts.value.filter(a => a.id !== id)
    if (activeAccountId.value === id) {
      activeAccountId.value = accounts.value[0]?.id ?? null
    }
    if (account && import.meta.client) {
      storageRemove(`${PUSH_SUB_KEY_PREFIX}${account.id}-${account.serverUrl}`)
      pushCredentials.deleteForServer(account.serverUrl).catch(() => {
        // Ignore — stale SW credentials fail closed (server rejects the token)
      })
    }
    return save()
  }

  function updateAccount(id: string, updates: Partial<CollctAccount>): boolean {
    const account = accounts.value.find(a => a.id === id)
    if (!account) return false
    Object.assign(account, updates)
    return save()
  }

  function switchAccount(id: string): boolean {
    if (!accounts.value.some(a => a.id === id)) return false
    activeAccountId.value = id
    return save()
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

  async function requestAuthorization(serverUrl: string, appName = 'Collct', redirectUri?: string) {
    return $fetch<{
      authorize_url: string
      code: string
      state?: string
    }>('/api/auth/authorize', {
      baseURL: serverUrl,
      method: 'post',
      body: {
        redirect_uri: redirectUri || window.location.origin + '/login',
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
    storageStatus: readonly(storageStatus),
    lastActiveAt: readonly(lastActiveAt),
    corruptBackupFound: readonly(corruptBackupFound),
    addAccount,
    removeAccount,
    updateAccount,
    switchAccount,
    testConnection,
    requestAuthorization,
    exchangeToken
  }
}
