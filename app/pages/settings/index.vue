<script setup lang="ts">
const router = useRouter()
const toast = useToast()
const api = useApi()
const { activeAccount, removeAccount, accounts } = useAccounts()
const { isPwa, permission, notificationStatus, requestPermission, unsubscribe, retry } = usePushNotifications()
const { platform } = usePlatform()

const accountState = reactive({
  name: activeAccount.value?.user?.name ?? '',
  email: ''
})

const saving = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
const uploadingAvatar = ref(false)
const retrying = ref(false)

const serverVersion = ref<string | null>(null)

try {
  const v = await api.getVersion()
  serverVersion.value = v.version
} catch {
  // ignore
}

const statusConfig = computed(() => {
  switch (notificationStatus.value) {
    case 'unsupported':
      return {
        icon: 'i-lucide-bell-off',
        iconClass: 'text-muted',
        label: 'Not supported',
        description: isPwa.value
          ? 'Your browser doesn\'t support push notifications.'
          : 'Install this app to your home screen to enable notifications.',
        showEnable: false,
        showDisable: false,
        showRetry: false
      }
    case 'disabled':
      return {
        icon: 'i-lucide-bell-off',
        iconClass: 'text-muted',
        label: 'Notifications blocked',
        description: 'Enable notifications in your browser settings.',
        showEnable: false,
        showDisable: false,
        showRetry: false
      }
    case 'pending':
      return {
        icon: 'i-lucide-bell-ring',
        iconClass: 'text-primary animate-pulse',
        label: 'Requesting permission...',
        description: 'Waiting for your response.',
        showEnable: false,
        showDisable: false,
        showRetry: false
      }
    case 'active':
      return {
        icon: 'i-lucide-bell-ring',
        iconClass: 'text-success',
        label: 'Notifications enabled',
        description: 'You\'ll receive push notifications for new likes, comments, group joins, and moments.',
        showEnable: false,
        showDisable: true,
        showRetry: false
      }
    case 'stale':
      return {
        icon: 'i-lucide-refresh-cw',
        iconClass: 'text-primary animate-spin',
        label: 'Re-enabling notifications...',
        description: 'Your subscription expired. Re-enabling automatically.',
        showEnable: false,
        showDisable: false,
        showRetry: false
      }
    case 'error':
      return {
        icon: 'i-lucide-triangle-alert',
        iconClass: 'text-error',
        label: 'Notifications failed',
        description: 'Could not set up push notifications.',
        showEnable: false,
        showDisable: false,
        showRetry: true
      }
    default:
      return {
        icon: 'i-lucide-bell',
        iconClass: 'text-muted',
        label: 'Notifications not enabled',
        description: 'Enable notifications to get alerted when friends interact with your photos.',
        showEnable: true,
        showDisable: false,
        showRetry: false
      }
  }
})

const showIosNote = computed(() => {
  if (!import.meta.client) return false
  if (platform.value === 'apns') return notificationStatus.value === 'active'
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return isIos && isPwa.value && notificationStatus.value === 'active'
})

const showAndroidNote = computed(() => {
  return platform.value === 'fcm' && notificationStatus.value === 'active'
})

async function enableNotifications() {
  const granted = await requestPermission()
  if (granted) {
    toast.add({ title: 'Notifications enabled', color: 'success' })
  } else if (permission.value === 'denied') {
    toast.add({ title: 'Permission denied', description: 'You can enable notifications in your browser settings.', color: 'warning' })
  } else {
    toast.add({ title: 'Connection failed', description: 'Could not reach the server to set up notifications. Check your connection and try again.', color: 'error' })
  }
}

async function disableNotifications() {
  await unsubscribe()
  toast.add({ title: 'Notifications disabled', color: 'success' })
}

async function retryNotifications() {
  retrying.value = true
  try {
    const ok = await retry()
    if (ok) {
      toast.add({ title: 'Notifications re-enabled', color: 'success' })
    } else {
      toast.add({ title: 'Retry failed', description: 'Could not set up notifications. Check your connection and try again.', color: 'error' })
    }
  } finally {
    retrying.value = false
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
    const { avatarUrl } = await api.uploadAvatar(file)
    if (activeAccount.value?.user) {
      activeAccount.value.user.avatarUrl = avatarUrl
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
    await api.updateUser({ name: accountState.name, email: accountState.email })
    if (activeAccount.value?.user) {
      activeAccount.value.user.name = accountState.name
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
    avatar: { src: activeAccount.value?.user?.avatarUrl || undefined, alt: activeAccount.value?.user?.name }
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
                :src="activeAccount?.user?.avatarUrl || undefined"
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
              <p
                v-if="showAndroidNote"
                class="text-xs text-muted mt-1 italic"
              >
                Note: Notifications should arrive promptly on Android.
              </p>
            </div>
            <UButton
              v-if="statusConfig.showEnable"
              color="primary"
              size="xs"
              @click="enableNotifications"
            >
              Enable
            </UButton>
            <UButton
              v-else-if="statusConfig.showDisable"
              color="neutral"
              variant="outline"
              size="xs"
              @click="disableNotifications"
            >
              Disable
            </UButton>
            <UButton
              v-else-if="statusConfig.showRetry"
              color="primary"
              variant="outline"
              size="xs"
              :loading="retrying"
              @click="retryNotifications"
            >
              Retry
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
