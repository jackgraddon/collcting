export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const { accounts, loaded } = useAccounts()

  // Wait for accounts to load from localStorage
  if (!loaded.value) return

  // Allow /login and /join pages without accounts
  if (to.path === '/login' || to.path.startsWith('/join/')) return

  // Redirect to login if no accounts
  if (accounts.value.length === 0) {
    return navigateTo('/login')
  }
})
