<script setup lang="ts">
definePageMeta({
  layout: false
})

const router = useRouter()
const { addAccount, testConnection, accounts } = useAccounts()

const serverUrl = ref('')
const token = ref('')
const accountName = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

async function handleAddAccount() {
  error.value = null
  loading.value = true

  try {
    let url = serverUrl.value.trim()
    if (!url.startsWith('http')) {
      url = 'https://' + url
    }
    url = url.replace(/\/$/, '')

    const user = await testConnection(url, token.value)
    if (!user) {
      error.value = 'Could not connect to server. Check your server URL and API token.'
      return
    }

    const account: CollctAccount = {
      id: crypto.randomUUID(),
      name: accountName.value || user.name || new URL(url).hostname,
      serverUrl: url,
      token: token.value,
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

      <form @submit.prevent="handleAddAccount">
        <div class="space-y-4">
          <UFormField label="Server URL">
            <UInput
              v-model="serverUrl"
              placeholder="https://photos.example.com"
              icon="solar:planet-3-linear"
              required
            />
          </UFormField>

          <UFormField label="API Token">
            <UInput
              v-model="token"
              placeholder="ct_xxxxxxxxxxxxxxxxxxxxxxxx"
              icon="solar:key-linear"
              type="password"
              required
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

          <UAlert
            v-if="error"
            :description="error"
            color="error"
            variant="subtle"
            icon="solar:danger-triangle-bold"
          />

          <UButton
            type="submit"
            label="Connect"
            :loading="loading"
            block
            size="lg"
          />
        </div>
      </form>

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
