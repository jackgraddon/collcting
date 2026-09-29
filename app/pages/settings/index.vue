<script setup lang="ts">
const router = useRouter()
const toast = useToast()
const api = useApi()
const { activeAccount, removeAccount, accounts, updateAccount, testConnection, storageStatus, lastActiveAt, corruptBackupFound } = useAccounts()
const { status: notifStatus, permission: notifPermission, busy: notifBusy, subscribe: subscribePush, unsubscribe: unsubscribePush, refresh: refreshPush } = usePushSubscription()
const { isPwa, isIos } = usePlatform()
const { public: { isBeta } } = useRuntimeConfig()
const { mediaUrl } = useMediaUrl()

const accountState = reactive({
  name: activeAccount.value?.user?.name ?? '',
  email: ''
})

const saving = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
const uploadingAvatar = ref(false)
const retrying = ref(false)
const testingPush = ref(false)

const serverVersion = ref<string | null>(null)

try {
  const v = await api.getVersion()
  serverVersion.value = v.version
} catch {
  // ignore
}

// Self-heal stale cached profile (e.g. avatar uploaded elsewhere or lost
// before we persisted it) — the server is source of truth.
try {
  const me = await api.getMe()
  if (activeAccount.value) {
    updateAccount(activeAccount.value.id, {
      user: { id: me.id, name: me.name, username: me.username, avatarUrl: me.avatarUrl }
    })
  }
} catch {
  // Offline — keep cached profile
}

const notificationsOn = computed(() => notifStatus.value === 'on')
const canToggleNotifications = computed(() => notifStatus.value === 'on' || notifStatus.value === 'off')

const statusConfig = computed(() => {
  switch (notifStatus.value) {
    case 'unsupported':
      return {
        icon: 'i-lucide-bell-off',
        iconClass: 'text-muted',
        label: 'Not supported',
        description: isPwa.value
          ? 'Your browser doesn\'t support push notifications.'
          : 'Install this app to your home screen to enable notifications.'
      }
    case 'denied':
      return {
        icon: 'i-lucide-bell-off',
        iconClass: 'text-muted',
        label: 'Notifications blocked',
        description: 'Enable notifications in your browser settings to turn them on here.'
      }
    case 'on':
      return {
        icon: 'i-lucide-bell-ring',
        iconClass: 'text-success',
        label: 'Notifications enabled',
        description: 'You\'ll receive push notifications for new likes, comments, group joins, and moments.'
      }
    case 'error':
      return {
        icon: 'i-lucide-triangle-alert',
        iconClass: 'text-error',
        label: 'Notifications failed',
        description: 'Could not set up push notifications.'
      }
    default:
      return {
        icon: 'i-lucide-bell',
        iconClass: 'text-muted',
        label: 'Notifications off',
        description: 'Enable notifications to get alerted when friends interact with your photos.'
      }
  }
})

const showIosNote = computed(() => {
  return isIos.value && isPwa.value && notifStatus.value === 'on'
})

async function onToggleNotifications(on: boolean) {
  if (on) {
    const ok = await subscribePush()
    if (ok) {
      toast.add({ title: 'Notifications enabled', color: 'success' })
    } else if (notifPermission.value === 'denied') {
      toast.add({ title: 'Permission denied', description: 'You can enable notifications in your browser settings.', color: 'warning' })
    } else {
      toast.add({ title: 'Connection failed', description: 'Could not reach the server to set up notifications. Check your connection and try again.', color: 'error' })
    }
  } else {
    await unsubscribePush()
    toast.add({ title: 'Notifications disabled', color: 'success' })
  }
}

async function retryNotifications() {
  retrying.value = true
  try {
    await refreshPush()
    if (notifStatus.value === 'on') {
      toast.add({ title: 'Notifications re-enabled', color: 'success' })
    } else {
      toast.add({ title: 'Retry failed', description: 'Could not set up notifications. Check your connection and try again.', color: 'error' })
    }
  } finally {
    retrying.value = false
  }
}

async function sendTestPush() {
  testingPush.value = true
  try {
    const { results } = await api.sendTestPush()
    console.debug('[push] Test results:', results)
    if (!results.length) {
      toast.add({ title: 'No subscriptions', description: 'The server has no push subscriptions for this account.', color: 'warning' })
      return
    }
    const sent = results.filter(r => r.status === 'sent').length
    const failed = results.filter(r => r.status === 'failed')
    if (failed.length === 0) {
      toast.add({ title: 'Test push sent', description: `Delivered to ${sent} endpoint${sent === 1 ? '' : 's'}. Check your notifications.`, color: 'success' })
    } else {
      toast.add({ title: 'Test push partially failed', description: failed[0]?.error || `${failed.length} endpoint${failed.length === 1 ? '' : 's'} failed.`, color: 'error' })
    }
  } catch (e: unknown) {
    const err = e as { statusCode?: number, data?: { statusMessage?: string } }
    let description = err.data?.statusMessage ?? 'Something went wrong.'
    if (err.statusCode === 429) {
      description = 'Rate limited — try again in a few minutes.'
    } else if (err.statusCode === 404) {
      description = 'This server doesn\'t support test pushes yet — it needs an update.'
    }
    toast.add({ title: 'Test push failed', description, color: 'error' })
  } finally {
    testingPush.value = false
  }
}

function triggerAvatarUpload() {
  avatarInput.value?.click()
}

async function onAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploadingAvatar.value = true
  try {
    const avatar = await compressAvatar(file)
    const { avatarUrl } = await api.uploadAvatar(avatar)
    if (activeAccount.value?.user) {
      updateAccount(activeAccount.value.id, {
        user: { ...activeAccount.value.user, avatarUrl }
      })
    }
    toast.add({ title: 'Avatar updated', color: 'success' })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.add({ title: 'Upload failed', description: err.data?.statusMessage ?? 'Something went wrong.', color: 'error' })
  } finally {
    uploadingAvatar.value = false
    if (avatarInput.value) avatarInput.value.value = ''
  }
}

async function onSaveAccount() {
  saving.value = true
  try {
    // Partial update — omit empty fields so server validation doesn't reject them.
    const body: { name?: string, email?: string } = {}
    if (accountState.name.trim()) body.name = accountState.name.trim()
    if (accountState.email.trim()) body.email = accountState.email.trim()
    if (Object.keys(body).length === 0) {
      toast.add({ title: 'Nothing to save', description: 'No changes to update.', color: 'warning' })
      return
    }
    await api.updateUser(body)
    if (activeAccount.value?.user && body.name) {
      updateAccount(activeAccount.value.id, {
        user: { ...activeAccount.value.user, name: body.name }
      })
    }
    toast.add({ title: 'Saved', description: 'Your account has been updated.', color: 'success' })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.add({ title: 'Error', description: err.data?.statusMessage ?? 'Something went wrong.', color: 'error' })
  } finally {
    saving.value = false
  }
}

function disconnectAccount() {
  if (!activeAccount.value) return
  removeAccount(activeAccount.value.id)
  if (accounts.value.length === 0) {
    router.push('/login')
  } else {
    router.push('/')
  }
}

const diagnostics = reactive({
  quota: null as null | { quota?: number, usage?: number },
  sw: 'checking…',
  tokenResults: {} as Record<string, boolean | null>,
  checkingTokens: false
})

function formatBytes(n?: number): string {
  if (n == null) return 'unknown'
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} GB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} TB`
}

function formatLastActive(ts: number | null): string {
  if (!ts) return 'never'
  return new Date(ts).toLocaleString()
}

const storageStatusText = computed(() => {
  switch (storageStatus.value) {
    case 'ok': return 'healthy'
    case 'empty': return lastActiveAt.value ? 'empty (was active here before)' : 'empty (first run)'
    case 'blocked': return 'blocked'
    case 'corrupt': return 'recovered from damage'
    default: return 'unknown'
  }
})

onMounted(async () => {
  if (!import.meta.client) return
  try {
    const est = await navigator.storage?.estimate()
    diagnostics.quota = { quota: est?.quota, usage: est?.usage }
  } catch {
    diagnostics.quota = null
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    diagnostics.sw = !reg ? 'none' : reg.active ? 'active' : reg.waiting ? 'waiting' : reg.installing ? 'installing' : 'unknown'
  } catch {
    diagnostics.sw = 'unavailable'
  }
})

async function checkAccountTokens() {
  diagnostics.checkingTokens = true
  try {
    for (const a of accounts.value) {
      try {
        diagnostics.tokenResults[a.id] = !!(await testConnection(a.serverUrl, a.token))
      } catch {
        diagnostics.tokenResults[a.id] = false
      }
    }
  } finally {
    diagnostics.checkingTokens = false
  }
}

async function copyDiagnostics() {
  const lines = [
    `Collcting diagnostics (${isBeta ? 'beta' : 'production'})`,
    `Accounts: ${accounts.value.length}`,
    `Storage: ${storageStatusText.value}`,
    `Last active here: ${formatLastActive(lastActiveAt.value)}`,
    `Damaged backup: ${corruptBackupFound.value ? 'yes' : 'no'}`,
    `Quota: ${diagnostics.quota ? `${formatBytes(diagnostics.quota.usage)} of ${formatBytes(diagnostics.quota.quota)}` : 'unknown'}`,
    `Service worker: ${diagnostics.sw}`,
    `Installed app: ${isPwa.value ? 'yes' : 'no'}`,
    `User agent: ${import.meta.client ? navigator.userAgent : 'n/a'}`,
    ...accounts.value.map(a => `Account ${a.name} (${a.serverUrl}): token ${diagnostics.tokenResults[a.id] == null ? 'unchecked' : diagnostics.tokenResults[a.id] ? 'valid' : 'INVALID'}`)
  ]
  try {
    if (!import.meta.client || !navigator.clipboard) throw new Error('no clipboard')
    await navigator.clipboard.writeText(lines.join('\n'))
    toast.add({ title: 'Diagnostics copied', description: 'Send it to whoever is helping you debug.', color: 'success' })
  } catch {
    toast.add({ title: 'Copy failed', description: 'Long-press the values to copy them manually.', color: 'error' })
  }
}

const tabs = computed(() => [
  {
    slot: 'account',
    label: 'Account',
    avatar: { src: mediaUrl(activeAccount.value?.user?.avatarUrl) || undefined, alt: activeAccount.value?.user?.name }
  },
  {
    slot: 'notifications',
    label: 'Notifications',
    icon: 'i-lucide-bell'
  },
  {
    slot: 'appearance',
    label: 'Appearance',
    icon: 'i-lucide-palette'
  },
  {
    slot: 'help',
    label: 'Help',
    icon: 'i-lucide-circle-help'
  }
])
</script>

<template>
  <div class="max-w-2xl mx-auto py-10">
    <UTabs
      :items="tabs"
      variant="link"
      :ui="{ label: 'hidden sm:inline' }"
    >
      <template #account>
        <div class="my-4">
          <div class="flex items-center gap-4">
            <div
              class="relative group cursor-pointer"
              @click="triggerAvatarUpload"
            >
              <UAvatar
                :src="mediaUrl(activeAccount?.user?.avatarUrl) || undefined"
                :alt="activeAccount?.user?.name"
                size="xl"
              />
              <div class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <UIcon
                  name="i-lucide-camera"
                  class="text-white size-5"
                />
              </div>
              <input
                ref="avatarInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                class="hidden"
                @change="onAvatarChange"
              >
            </div>
            <div>
              <p class="font-semibold text-lg">
                {{ activeAccount?.user?.name }}
              </p>
              <p class="text-sm text-muted">
                {{ activeAccount?.serverUrl }}
              </p>
            </div>
          </div>

          <UForm
            :state="accountState"
            class="flex flex-col gap-4 mt-4"
            @submit="onSaveAccount"
          >
            <UFormField
              label="Full Name"
              name="name"
            >
              <UInput
                v-model="accountState.name"
                class="w-full"
              />
            </UFormField>
          </UForm>

          <div class="flex justify-end gap-2 mt-4">
            <UButton
              to="/settings/accounts"
              color="neutral"
              variant="ghost"
              size="sm"
            >
              Manage Accounts
            </UButton>
            <UButton
              :loading="saving"
              @click="onSaveAccount"
            >
              Save changes
            </UButton>
          </div>
        </div>
      </template>

      <template #notifications>
        <div class="my-4 space-y-4">
          <p class="text-sm text-muted">
            Control whether you receive push notifications when friends interact with your photos.
          </p>

          <div class="flex items-center gap-3 p-3 rounded-lg border border-default">
            <UIcon
              :name="statusConfig.icon"
              class="w-5 h-5 shrink-0"
              :class="statusConfig.iconClass"
            />
            <div class="flex-1">
              <p class="text-sm font-medium">
                {{ statusConfig.label }}
              </p>
              <p class="text-xs text-muted mt-0.5">
                {{ statusConfig.description }}
              </p>
              <p
                v-if="showIosNote"
                class="text-xs text-muted mt-1 italic"
              >
                Note: Notifications may be delayed while the app is backgrounded (iOS limitation).
              </p>
            </div>
            <USwitch
              v-if="canToggleNotifications"
              :model-value="notificationsOn"
              :loading="notifBusy"
              @update:model-value="onToggleNotifications"
            />
            <UButton
              v-else-if="notifStatus === 'error'"
              color="primary"
              variant="outline"
              size="xs"
              :loading="retrying"
              @click="retryNotifications"
            >
              Retry
            </UButton>
          </div>

          <div
            v-if="notifStatus === 'on'"
            class="flex justify-end"
          >
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-bell-ring"
              :loading="testingPush"
              @click="sendTestPush"
            >
              Send test push
            </UButton>
          </div>
        </div>
      </template>

      <template #appearance>
        <div class="my-4 space-y-4">
          <UFormField label="Color Theme">
            <UColorModeSelect />
          </UFormField>
        </div>
      </template>

      <template #help>
        <div class="my-4 space-y-6">
          <div class="space-y-1">
            <p class="text-sm text-muted">
              Collct is a self-hosted photo sharing platform for friends and family. No algorithm. No tracking. No strangers.
            </p>
            <p class="text-xs text-muted">
              Your photos and data live on your server. Nothing is sent to third parties.
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted">Version</span>
              <span>{{ serverVersion ?? 'Unknown' }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted">Server</span>
              <span class="truncate max-w-[200px]">{{ activeAccount?.serverUrl }}</span>
            </div>
          </div>

          <div class="space-y-2">
            <UButton
              label="Report an issue"
              icon="i-lucide-flag"
              variant="outline"
              block
              to="https://github.com/jackgraddon/collcting/issues/new"
              target="_blank"
            />
            <UButton
              label="Source code"
              icon="i-lucide-github"
              variant="outline"
              block
              to="https://github.com/jackgraddon/collcting"
              target="_blank"
            />
            <UButton
              label="Disconnect account"
              icon="i-lucide-log-out"
              color="error"
              variant="ghost"
              block
              @click="disconnectAccount"
            />
          </div>
        </div>

        <div class="my-4 space-y-2">
          <div class="space-y-1">
            <p class="text-sm font-medium">
              Diagnostics
            </p>
            <p class="text-xs text-muted">
              Having login trouble? Copy this and send it to whoever is helping you.
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted">Accounts</span>
              <span>{{ accounts.length }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted">Storage</span>
              <span>{{ storageStatusText }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted">Last active here</span>
              <span>{{ formatLastActive(lastActiveAt) }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted">Quota</span>
              <span>{{ diagnostics.quota ? `${formatBytes(diagnostics.quota.usage)} of ${formatBytes(diagnostics.quota.quota)}` : 'unknown' }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted">Service worker</span>
              <span>{{ diagnostics.sw }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted">Installed app</span>
              <span>{{ isPwa ? 'yes' : 'no' }}</span>
            </div>
            <div
              v-for="a in accounts"
              :key="a.id"
              class="flex items-center justify-between text-sm gap-2"
            >
              <span class="text-muted truncate">
                Token · {{ a.name }}
              </span>
              <span
                class="shrink-0"
                :class="diagnostics.tokenResults[a.id] == null ? 'text-muted' : diagnostics.tokenResults[a.id] ? 'text-success' : 'text-error'"
              >
                {{ diagnostics.tokenResults[a.id] == null ? 'unchecked' : diagnostics.tokenResults[a.id] ? 'valid' : 'invalid' }}
              </span>
            </div>
          </div>

          <div class="flex gap-2">
            <UButton
              label="Check tokens"
              icon="i-lucide-refresh-cw"
              variant="outline"
              block
              :loading="diagnostics.checkingTokens"
              :disabled="accounts.length === 0"
              @click="checkAccountTokens"
            />
            <UButton
              label="Copy diagnostics"
              icon="i-lucide-clipboard-copy"
              variant="outline"
              block
              @click="copyDiagnostics"
            />
          </div>
        </div>
      </template>
    </UTabs>
  </div>
</template>
