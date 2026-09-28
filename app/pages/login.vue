<script setup lang="ts">
definePageMeta({
  layout: false
})

const router = useRouter()
const { addAccount, testConnection, accounts, requestAuthorization, exchangeToken } = useAccounts()
const { isNative } = usePlatform()

const serverUrl = ref('')
const accountName = ref('')
const apiToken = ref('')
const loading = ref(false)
const polling = ref(false)
const error = ref<string | null>(null)
const showTokenForm = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null
let appUrlOpenListener: { remove: () => Promise<void> } | null = null

async function handleBrowserAuth() {
  error.value = null
  loading.value = true

  try {
    let url = serverUrl.value.trim().toLowerCase()
    if (!url.startsWith('http')) {
      url = 'https://' + url
    }
    url = url.replace(/\/$/, '')

    const redirectUri = isNative.value
      ? 'collct://callback'
      : window.location.origin + '/login'

    const { authorize_url, code } = await requestAuthorization(url, 'Collct', redirectUri)

    if (isNative.value) {
      sessionStorage.setItem('collct_pending_auth', JSON.stringify({ serverUrl: url, code }))

      // Listen for the deep link callback
      const { App } = await import('@capacitor/app')
      appUrlOpenListener = await App.addListener('appUrlOpen', (event) => {
        const url = new URL(event.url)
        const redirectCode = url.searchParams.get('code')
        const redirectServer = url.searchParams.get('server_url')

        if (redirectCode && redirectServer) {
          handleDeepLinkCallback(redirectCode, redirectServer)
        }
      })

      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url: authorize_url })
    } else {
      sessionStorage.setItem('collct_pending_auth', JSON.stringify({ serverUrl: url, code }))
      window.location.href = authorize_url
    }
  } catch (e: unknown) {
    loading.value = false
    error.value = e instanceof Error ? e.message : 'Could not start authorization. Check your server URL.'
  }
}

async function handleDeepLinkCallback(code: string, server: string) {
  if (appUrlOpenListener) {
    await appUrlOpenListener.remove()
    appUrlOpenListener = null
  }
  const { Browser } = await import('@capacitor/browser')
  await Browser.close()

  window.history.replaceState({}, '', '/login')
  serverUrl.value = server
  polling.value = true
  pollForToken(server, code)
}

async function pollForToken(url: string, code: string) {
  if (pollTimer) clearInterval(pollTimer)

  pollTimer = setInterval(async () => {
    try {
      const result = await exchangeToken(url, code)
      if (pollTimer) clearInterval(pollTimer)
      pollTimer = null

      const user = await testConnection(url, result.access_token)
      if (!user) {
        error.value = 'Authorized but could not fetch user info.'
        polling.value = false
        return
      }

      const account: CollctAccount = {
        id: crypto.randomUUID(),
        name: accountName.value || user.name || new URL(url).hostname,
        serverUrl: url,
        token: result.access_token,
        user,
        connected: true,
        addedAt: Date.now()
      }

      addAccount(account)
      router.push('/')
    } catch {
      // Still pending, continue polling
    }
  }, 5000)
}

function cancelPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  polling.value = false
}

async function handleTokenAuth() {
  error.value = null
  loading.value = true

  try {
    let url = serverUrl.value.trim().toLowerCase()
    if (!url.startsWith('http')) {
      url = 'https://' + url
    }
    url = url.replace(/\/$/, '')

    if (!apiToken.value) {
      error.value = 'Please enter an API token.'
      return
    }

    const user = await testConnection(url, apiToken.value)
    if (!user) {
      error.value = 'Could not connect to server. Check your server URL and API token.'
      return
    }

    const account: CollctAccount = {
      id: crypto.randomUUID(),
      name: accountName.value || user.name || new URL(url).hostname,
      serverUrl: url,
      token: apiToken.value,
      user,
      connected: true,
      addedAt: Date.now()
    }

    addAccount(account)
    router.push('/')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

const hasExistingAccounts = computed(() => accounts.value.length > 0)
const { variant: installVariant, visible: installVisible, isSafariDesktop, promptInstall, dismiss: dismissInstall } = useAppInstall()

onMounted(() => {
  // Handle web redirect callback
  const params = new URLSearchParams(window.location.search)
  const redirectCode = params.get('code')
  const redirectServer = params.get('server_url')

  if (redirectCode && redirectServer) {
    window.history.replaceState({}, '', '/login')
    serverUrl.value = redirectServer
    polling.value = true
    pollForToken(redirectServer, redirectCode)
    return
  }

  // Handle pending auth from session storage
  const pending = sessionStorage.getItem('collct_pending_auth')
  if (pending) {
    sessionStorage.removeItem('collct_pending_auth')
    const { serverUrl: url, code } = JSON.parse(pending)
    serverUrl.value = url
    polling.value = true
    pollForToken(url, code)
    return
  }

  if (redirectServer && !serverUrl.value) {
    window.history.replaceState({}, '', '/login')
    serverUrl.value = redirectServer
  }
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (appUrlOpenListener) {
    appUrlOpenListener.remove()
    appUrlOpenListener = null
  }
})
</script>

<template>
  <div class="min-h-dvh flex flex-col pt-[var(--safe-area-top,env(safe-area-inset-top))] pb-[var(--safe-area-bottom,env(safe-area-inset-bottom))]">
    <UCard class="w-full max-w-md mx-auto mt-8">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-primary">
          Collct
        </h1>
        <p class="text-muted mt-2">
          A friends-first photo sharing app
        </p>
      </div>

      <div
        v-if="!polling"
        class="space-y-4"
      >
        <UFormField label="Server URL">
          <UInput
            v-model="serverUrl"
            placeholder="https://photos.example.com"
            icon="solar:planet-3-linear"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="!showTokenForm"
          label="Account Name (optional)"
        >
          <UInput
            v-model="accountName"
            placeholder="e.g. Family Photos"
            icon="solar:user-circle-linear"
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="error"
          :description="error"
          color="error"
          variant="subtle"
          icon="solar:danger-triangle-bold"
        />

        <UButton
          v-if="!showTokenForm"
          label="Connect in Browser"
          icon="solar:login-3-linear"
          :loading="loading"
          :disabled="!serverUrl.trim()"
          block
          size="lg"
          @click="handleBrowserAuth"
        />

        <div
          v-if="!showTokenForm"
          class="flex items-center gap-4 my-2"
        >
          <div class="flex-1 border-t border-muted" />
          <span class="text-xs text-muted">or</span>
          <div class="flex-1 border-t border-muted" />
        </div>

        <div v-if="!showTokenForm">
          <UButton
            label="Use an API Token instead"
            variant="ghost"
            block
            size="sm"
            @click="showTokenForm = true"
          />
        </div>

        <div v-if="showTokenForm">
          <form
            class="space-y-4"
            @submit.prevent="handleTokenAuth"
          >
            <UFormField label="API Token">
              <UInput
                v-model="apiToken"
                placeholder="ct_xxxxxxxxxxxxxxxxxxxxxxxx"
                icon="solar:key-linear"
                type="password"
              />
              <p class="text-xs text-muted mt-1">
                Generate a token in your server's Settings → Security
              </p>
            </UFormField>

            <UFormField label="Account Name (optional)">
              <UInput
                v-model="accountName"
                placeholder="e.g. Family Photos"
                icon="solar:user-circle-linear"
              />
            </UFormField>

            <UButton
              type="submit"
              label="Connect"
              :loading="loading"
              :disabled="!serverUrl.trim() || !apiToken.trim()"
              block
              size="lg"
            />

            <UButton
              label="Back"
              variant="ghost"
              block
              size="sm"
              @click="showTokenForm = false"
            />
          </form>
        </div>
      </div>

      <div
        v-else
        class="text-center space-y-4"
      >
        <div class="flex justify-center">
          <UIcon
            name="i-lucide-loader-2"
            class="size-12 text-primary animate-spin"
          />
        </div>
        <div>
          <p class="font-semibold">
            Waiting for authorization
          </p>
          <p class="text-sm text-muted mt-1">
            Complete the sign-in in the browser, then come back here.
          </p>
        </div>
        <UButton
          label="Cancel"
          variant="ghost"
          @click="cancelPolling"
        />
      </div>

      <div
        v-if="hasExistingAccounts"
        class="mt-6 text-center"
      >
        <UButton
          label="Back to feed"
          variant="ghost"
          to="/"
        />
      </div>
    </UCard>

    <div
      v-if="installVisible && !polling"
      class="w-full max-w-md mx-auto mt-4"
    >
      <div class="flex items-start gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
        <NuxtImg
          src="/app-icon-clear.png"
          alt="Collct"
          width="40"
          height="40"
          class="rounded-xl shrink-0"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold">
            Install Collcting
          </p>

          <template v-if="installVariant === 'prompt'">
            <p class="text-xs text-muted mt-0.5">
              Fullscreen, faster loads, and notifications — right from your home screen.
            </p>
            <UButton
              color="primary"
              size="xs"
              class="mt-2"
              icon="i-lucide-download"
              @click="promptInstall"
            >
              Install app
            </UButton>
          </template>

          <template v-else-if="installVariant === 'ios'">
            <p class="text-xs text-muted mt-0.5">
              Add to your Home Screen for fullscreen and faster loads.
            </p>
            <p class="text-xs text-muted mt-1">
              Push notifications require the installed app on iPhone.
            </p>
            <p class="text-xs text-muted mt-2 flex items-center gap-1.5">
              <UIcon
                name="i-lucide-share"
                class="w-3.5 h-3.5 shrink-0"
              />
              <span>Tap Share, then <span class="font-medium text-default">Add to Home Screen</span></span>
            </p>
          </template>

          <template v-else>
            <p class="text-xs text-muted mt-0.5">
              Install it for fullscreen and faster loads.
            </p>
            <p class="text-xs text-muted mt-1">
              {{ isSafariDesktop ? 'In Safari: File → Add to Dock.' : 'Open your browser menu and choose Install app.' }}
            </p>
          </template>
        </div>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Dismiss install suggestion"
          class="shrink-0 -mt-1 -mr-1"
          @click="dismissInstall"
        />
      </div>
    </div>
  </div>
</template>
