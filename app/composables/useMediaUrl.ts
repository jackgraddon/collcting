/**
 * The API returns server-relative blob URLs (e.g. `/api/blob/photos/...`).
 * Those paths live on the *server*, not on this client deployment, so they
 * must be resolved against the account's `serverUrl` before rendering.
 * Absolute URLs (and data:/blob: previews) pass through untouched, as do
 * local client assets when no server URL is given.
 */
export function resolveMediaUrl(path: string | null | undefined, serverUrl?: string | null): string | undefined {
  if (!path) return undefined
  if (/^(https?:\/\/|data:|blob:)/i.test(path)) return path
  if (!serverUrl) return path
  return `${serverUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

export function useMediaUrl() {
  const { activeAccount } = useAccounts()

  function mediaUrl(path: string | null | undefined, serverUrl?: string | null): string | undefined {
    return resolveMediaUrl(path, serverUrl ?? activeAccount.value?.serverUrl)
  }

  return { mediaUrl, resolveMediaUrl }
}
