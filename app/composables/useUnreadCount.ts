export function useUnreadCount() {
  const count = useState('unread-count', () => 0)
  const api = useApi()

  async function refresh() {
    try {
      const data = await api.getUnreadCount()
      count.value = data.count
    } catch {
      // Keep stale count on failure
    }
  }

  function setCount(n: number) {
    count.value = Math.max(0, n)
  }

  return { count, refresh, setCount }
}
