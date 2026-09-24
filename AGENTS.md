# AGENTS.md — Collcting

Multi-instance Nuxt 4 SPA client for [Collct](https://github.com/jackgraddon/collct) servers.
One codebase builds to web (Vercel PWA) and mobile (Capacitor). The server lives in a
separate repo; its `API.md` is the contract — check it before assuming endpoint shapes.

## Branches & deploys

- `dev` → beta deployment (`IS_BETA=true` env). `main` → production (unset).
- Feature work happens on branches merged into `dev`. Commit messages are imperative
  ("Fix …", "Add …"), no conventional-commit prefixes.

## Stack

Nuxt 4 (`ssr: false`, SPA), Vue 3 + TypeScript, Tailwind CSS v4, Nuxt UI v4, pnpm.
PWA via `@vite-pwa/nuxt` (Workbox). Mobile via Capacitor (`@capacitor/*`).

## Commands

- `pnpm dev` / `pnpm build` / `pnpm preview`
- `pnpm run lint` (`eslint .`) and `pnpm run typecheck` — both must pass before commit/push
- `pnpm cap:build` / `pnpm cap:ios` / `pnpm cap:android` — static generate + Capacitor sync
- `npx nuxt generate` — regenerates `.output/` including `sw.js` (verify Workbox output here)

## Conventions (hard-won — follow these)

- **Media URLs**: the API returns server-relative `/api/blob/...` paths. Always resolve them
  against the account's `serverUrl` via `useMediaUrl()`/`resolveMediaUrl()` — never render
  them raw (they'd resolve against the client origin). Server images use plain `<img>`;
  image provider is `none` (no optimizer exists). Multi-account lists must resolve each
  avatar against *that account's* server, not the active one.
- **Push subscribe shape**: `{ platform: 'web' | 'apns' | 'fcm', endpoint, keys? }` — always
  send `platform` explicitly. SW re-subscribe credentials live in IndexedDB
  (`app/utils/pushCredentials.ts` + inline copy in `public/push-handler.js`) — localStorage
  does not exist in service worker scope.
- **Upload compression** (`app/utils/compressImage.ts`): canvas pipeline, WebP @ ~0.85,
  GIFs pass through untouched, JPEG fallback when no WebP encoder, failures fall back to
  the original — conversion must never block an upload.
- **Partial updates**: `PATCH /user/update` rejects invalid values, so omit empty fields.
- **Safe areas**: `pt-[var(--safe-area-top,env(safe-area-inset-top))]` pattern; the header's
  `safeAreaTop` prop drops its duplicate padding when something (e.g. beta banner) sits above it.
- **Capacitor**: dynamic `import()` only — static `@capacitor/*` imports break web builds.
- **Workbox**: routes are first-match-wins — order specific before generic. `navigateFallback`
  stays `''`: with `ssr: false` the build emits no static HTML, so any fallback URL makes
  SW evaluation throw `non-precached-url` and aborts all later route registrations.
- **Server URLs**: normalize on entry (trim, lowercase, strip trailing slash).

## Multi-instance model

- Accounts pair `serverUrl` + bearer token (localStorage). All API calls go through `$api`
  with the active account's credentials; per-account overrides via explicit options.
- Shared links carry `?server_url=`; resolving pages call `ensureServerContext()` to switch
  accounts or redirect to login. Push payloads carry no server context (server limitation).

## MCP / agent tooling

- `opencode.json` is intentionally gitignored (local-only by design). On a fresh machine,
  add the remote connectors: `nuxt-ui` → `https://ui.nuxt.com/mcp`,
  `nuxt-docs` → `https://nuxt.com/mcp`.
- Prefer the `nuxt-ui_*` tools (components, metadata, icons, docs) over guessing at Nuxt UI
  props/slots, and `nuxt-docs_*` for Nuxt framework behavior questions.
