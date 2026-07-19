Collct Standalone PWA — Build Plan
Overview
A standalone, multi-account PWA built with Nuxt 4 + Nuxt UI (SPA mode) that connects to any Collct server via bearer tokens. Feature parity with the bundled client, plus multi-account switching.
Stack: Nuxt 4 (ssr: false), Nuxt UI v4, Tailwind CSS v4, TypeScript  
Deploy: Vercel / Netlify (static SPA)
Part 1: Server-Side Changes (main Collct repo, prerequisite)
1A. CORS Middleware
- New env: COLLCT_APP_URL — origin of the PWA (e.g. https://app.collct.io), comma-separated for multiple
- New middleware: server/middleware/cors.ts — sets Access-Control-Allow-Origin, allows Authorization header, handles OPTIONS preflight
1B. Token-Based Auth
- New DB table: api_tokens (id, userId, name, tokenHash, createdAt, lastUsedAt, expiresAt)
- Utility: createApiToken() — generates randomBytes(32).toString('base64url') + SHA-256 hash
- New routes:
- POST /api/auth/tokens — generate token (requires session), returns raw token once
- GET /api/auth/tokens — list tokens for current user
- DELETE /api/auth/tokens/:id — revoke token
- New middleware: server/middleware/api-token-auth.ts — checks Authorization: Bearer <token>, hashes it, looks up DB, sets user context so requireUserSession() works transparently
1C. Token Generation UI
- Add "Generate API Token" button in the existing settings/security page
- Shows raw token once with copy button + warning
Part 2: PWA Architecture (new repo)
2A. Multi-Account Data Model (localStorage)
interface CollctAccount {
  id: string              // crypto.randomUUID()
  name: string            // User-chosen label
  serverUrl: string       // e.g. "https://photos.example.com"
  token: string           // Raw API token
  user: { id: number; name: string; username: string; avatarUrl: string | null } | null
  connected: boolean
  addedAt: number
}
Key composable: useAccounts() — load/save from localStorage, add/remove accounts, switch active account, test connection.
2B. API Client
Custom $api<T>(path, options) wrapper that:
1. Reads activeAccount.serverUrl as base URL
2. Injects Authorization: Bearer <token> header
3. Calls standard $fetch
Plus useApi() composable with typed methods for every endpoint (photos, comments, likes, groups, notifications, user).
2C. Pages & Routing
Route
/
/login
/feed
/post/:id
/upload
/groups
/groups/:id
/join/:code
/notifications
/user/:username
/settings
/settings/accounts
2D. New Components
Component
AccountSwitcher.vue
AddAccountModal.vue
ServerStatusBadge.vue
EmptyState.vue
2E. Login (Add Account) Flow
1. Enter server URL
2. PWA probes GET /api/version + GET /api/user/me with token
3. If valid: cache user info, show success, save account
4. If invalid: show error with instructions ("Go to your server → Settings → Security → Generate API Token")
2F. Key Decisions
Decision
ssr: false
Bearer tokens
localStorage
No shared state between accounts
Image passthrough
Token generated on server UI
Part 3: Build Order
Phase 1 — Server Changes (main repo)
1. api_tokens table + migration
2. createApiToken() utility
3. Token CRUD routes + validation middleware
4. CORS middleware + COLLCT_APP_URL env
5. "Generate API Token" button in settings
6. End-to-end test
Phase 2 — PWA Scaffolding (new repo)
1. nuxt init with ssr: false
2. Install Nuxt UI, PWA module, fonts, icon
3. Theme colors, base layout
4. useAccounts composable + localStorage
5. $api client + useApi composable
6. Auth middleware
7. Port types from shared/types
Phase 3 — Core Pages
1. /login — Add Account flow
2. /settings/accounts — Account management
3. AccountSwitcher in header
4. Feed + photo detail (with comments/likes)
Phase 4 — Full Feature Parity
1. Upload, groups, notifications, profiles, settings
2. Pull-to-refresh, infinite scroll
3. Push notifications (per-server)
Phase 5 — Polish
1. Offline caching, error states, loading skeletons
2. Dark/light mode, mobile testing
3. PWA install prompt, splash screens
Components to Port (with changes)
Most existing components port directly. Key adaptations:
- Header.vue — swap useUserSession() for useAccounts().activeAccount, add AccountSwitcher
- UploadModal.vue — use useApi().uploadPhoto()
- Post/comments.vue — use useApi() for CRUD
- NotificationBell.vue — use useApi().getUnreadCount()
- LogoutButton.vue — remove account from localStorage instead of clearing session
- All Post display components — no changes needed (pure presentational)
Composables to Port
Composable
useUser.ts
useNotificationPolling.ts
usePullToRefresh.ts
useUploadBus.ts
usePushNotifications.ts