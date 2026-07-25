function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase()
}

export function useServerContext() {
  const { accounts, activeAccount, switchAccount } = useAccounts()

  function findAccountByUrl(serverUrl: string): CollctAccount | undefined {
    const normalized = normalizeUrl(serverUrl)
    return accounts.value.find(a => normalizeUrl(a.serverUrl) === normalized)
  }

  function switchToServer(serverUrl: string): CollctAccount | null {
    const account = findAccountByUrl(serverUrl)
    if (account && account.id !== activeAccount.value?.id) {
      switchAccount(account.id)
    }
    return account ?? null
  }

  async function ensureServerContext(serverUrl: string | undefined | null): Promise<CollctAccount | null> {
    if (!serverUrl) return activeAccount.value
    const account = switchToServer(serverUrl)
    if (!account) {
      await navigateTo(`/login?add_server=${encodeURIComponent(serverUrl)}`)
    }
    return account
  }

  return {
    findAccountByUrl,
    switchToServer,
    ensureServerContext
  }
}
