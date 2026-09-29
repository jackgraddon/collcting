export type StorageHealth = 'unknown' | 'ok' | 'empty' | 'blocked' | 'corrupt'

// Probe write — the only reliable way to know storage is usable. Returns
// false on server, in blocked contexts (private mode, Block All Cookies,
// content blockers), or under quota pressure.
export function storageAvailable(): boolean {
  if (!import.meta.client) return false
  try {
    const probe = '__collct_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

// Distinguishes missing (null value, readable) from blocked (unreadable).
export function storageRead(key: string): { readable: boolean, value: string | null } {
  if (!import.meta.client) return { readable: false, value: null }
  try {
    return { readable: true, value: localStorage.getItem(key) }
  } catch {
    return { readable: false, value: null }
  }
}

export function storageGet(key: string): string | null {
  return storageRead(key).value
}

export function storageSet(key: string, value: string): boolean {
  if (!import.meta.client) return false
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function storageRemove(key: string): void {
  if (!import.meta.client) return
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore — removal is best-effort cleanup
  }
}

export function sessionGet(key: string): string | null {
  if (!import.meta.client) return null
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function sessionSet(key: string, value: string): boolean {
  if (!import.meta.client) return false
  try {
    sessionStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function sessionRemove(key: string): void {
  if (!import.meta.client) return
  try {
    sessionStorage.removeItem(key)
  } catch {
    // Ignore
  }
}
