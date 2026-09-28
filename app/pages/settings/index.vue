<script setup lang="ts">
const router = useRouter()
const toast = useToast()
const api = useApi()
const { activeAccount, removeAccount, accounts, updateAccount } = useAccounts()
const { status: notifStatus, permission: notifPermission, busy: notifBusy, subscribe: subscribePush, unsubscribe: unsubscribePush, refresh: refreshPush } = usePushSubscription()
const { isPwa, isIos } = usePlatform()
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
    const description = err.statusCode === 429
      ? 'Rate limited — try again in a few minutes.'
      : err.data?.statusMessage ?? 'Something went wrong.'
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
      </template>
    </UTabs>
  </div>
</template>
