<script setup lang="ts">
const toast = useToast()
const api = useApi()
const { activeAccount } = useAccounts()
const { isSupported, isSubscribed, permission, requestPermission, unsubscribe } = usePushNotifications()

const accountState = reactive({
  name: activeAccount.value?.user?.name ?? '',
  email: ''
})

const saving = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
const uploadingAvatar = ref(false)

const isPushGranted = computed(() => permission.value === 'granted' && isSubscribed.value)
const isPushDenied = computed(() => permission.value === 'denied')
const isPushNotSupported = computed(() => !isSupported.value)

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

async function enableNotifications() {
  const granted = await requestPermission()
  if (granted) {
    toast.add({ title: 'Notifications enabled', color: 'success' })
  } else {
    toast.add({ title: 'Permission denied', description: 'You can enable notifications in your browser settings.', color: 'warning' })
  }
}

async function disableNotifications() {
  await unsubscribe()
  toast.add({ title: 'Notifications disabled', color: 'success' })
}

const tabs = [
  {
    slot: 'account',
    label: 'Account'
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
]
</script>

<template>
  <div class="max-w-2xl mx-auto py-10">
    <UTabs
      :items="tabs"
      variant="link"
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
              :name="isPushGranted ? 'i-lucide-bell-ring' : 'i-lucide-bell-off'"
              class="w-5 h-5 shrink-0"
              :class="isPushGranted ? 'text-green-500' : 'text-muted'"
            />
            <div class="flex-1">
              <p class="text-sm font-medium">
                {{ isPushGranted ? 'Notifications enabled' : isPushDenied ? 'Notifications blocked' : isPushNotSupported ? 'Not supported in this browser' : 'Notifications not enabled' }}
              </p>
              <p class="text-xs text-muted mt-0.5">
                {{ isPushDenied
                  ? 'You\'ll need to enable notifications in your browser settings.'
                  : isPushGranted
                    ? 'You\'ll receive push notifications for new likes, comments, and group joins.'
                    : isPushNotSupported
                      ? 'Your browser doesn\'t support push notifications.'
                      : 'Enable notifications to get alerted when friends interact with your photos.'
                }}
              </p>
            </div>
            <UButton
              v-if="!isPushGranted && !isPushDenied && !isPushNotSupported"
              color="primary"
              size="xs"
              @click="enableNotifications"
            >
              Enable
            </UButton>
            <UButton
              v-else-if="isPushGranted"
              color="neutral"
              variant="outline"
              size="xs"
              @click="disableNotifications"
            >
              Disable
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
        <div class="my-4 space-y-4">
          <p class="text-sm text-muted">
            Collct is a self-hosted photo sharing platform for friends and family.
          </p>
          <div class="text-sm text-muted space-y-2">
            <p>Visit your server's documentation for help with your Collct instance.</p>
          </div>
        </div>
      </template>
    </UTabs>
  </div>
</template>
