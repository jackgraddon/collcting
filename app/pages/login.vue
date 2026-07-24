<script setup lang="ts">
definePageMeta({
  layout: false
})

const router = useRouter()
const { addAccount, testConnection, accounts, requestAuthorization, exchangeToken } = useAccounts()

const serverUrl = ref('')
const accountName = ref('')
const apiToken = ref('')
const loading = ref(false)
const polling = ref(false)
const error = ref<string | null>(null)
const showTokenForm = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

async function handleBrowserAuth() {
  error.value = null
  loading.value = true

  try {
    let url = serverUrl.value.trim()
    if (!url.startsWith('http')) {
      url = 'https://' + url
    }
    url = url.replace(/\/$/, '')

    const { authorize_url, code } = await requestAuthorization(url)

    window.open(authorize_url, '_blank')

    loading.value = false
    polling.value = true

    pollForToken(url, code)
  } catch (e: unknown) {
    loading.value = false
    error.value = e instanceof Error ? e.message : 'Could not start authorization. Check your server URL.'
  }
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
    let url = serverUrl.value.trim()
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

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="min-h-[calc(100dvh-4rem)] flex items-center justify-center p-4">
    <UCard class="w-full max-w-md">
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
          class="relative"
        >
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-muted" />
          </div>
          <div class="relative flex justify-center text-xs">
            <span class="bg-[var(--ui-card)] px-2 text-muted">or</span>
          </div>
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
            Complete the sign-in in the browser tab that opened, then come back here.
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
  </div>
</template>
