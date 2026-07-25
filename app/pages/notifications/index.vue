<script lang="ts" setup>
const router = useRouter()
const api = useApi()
const { shouldPrompt, requestPermission, dismissPrompt } = usePushNotifications()

const showPrompt = computed(() => shouldPrompt.value)

async function enableNotifications() {
  await requestPermission()
}

const notifications = ref<Notification[]>([])
const nextCursor = ref<number | null>(null)
const loading = ref(true)
const loadingMore = ref(false)

const unreadCount = computed(() => notifications.value.filter(n => !n.isRead).length)

async function fetchNotifications(cursor?: number) {
  const params: Record<string, number> = { limit: 20 }
  if (cursor) params.before = cursor
  return await api.getNotifications(params)
}

try {
  const result = await fetchNotifications()
  notifications.value = result.notifications
  nextCursor.value = result.nextCursor
} finally {
  loading.value = false
}

async function loadMore() {
  if (!nextCursor.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const result = await fetchNotifications(nextCursor.value)
    notifications.value.push(...result.notifications)
    nextCursor.value = result.nextCursor
  } finally {
    loadingMore.value = false
  }
}

async function markRead(n: Notification) {
  if (n.isRead) return
  n.isRead = true
  await api.markNotificationsRead({ ids: [n.id] })
}

async function markAllRead() {
  const unreadIds = notifications.value.filter(n => !n.isRead).map(n => n.id)
  if (!unreadIds.length) return
  for (const n of notifications.value) {
    n.isRead = true
  }
  await api.markNotificationsRead({ all: true })
}

function notificationText(n: Notification): string {
  switch (n.type) {
    case 'like':
      return ' liked your photo'
    case 'comment':
      return ' commented on your photo'
    case 'group_invite':
      return ' invited you to a group'
    default:
      return ' interacted with your content'
  }
}

function notificationLink(n: Notification): string {
  if (n.photoId) return `/post/${n.photoId}`
  if (n.groupId) return `/groups/${n.groupId}`
  return '/'
}

function formatRelativeTime(date: string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(date))
}
</script>

<template>
  <div class="w-full max-w-2xl mx-auto py-10">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <UButton
          color="neutral"
          variant="ghost"
          icon="solar:arrow-left-linear"
          size="sm"
          @click="router.back()"
        />
        <h1 class="text-xl font-semibold">
          Notifications
        </h1>
      </div>
      <UButton
        v-if="unreadCount > 0"
        color="neutral"
        variant="ghost"
        size="xs"
        @click="markAllRead"
      >
        Mark all read
      </UButton>
    </div>

    <div
      v-if="showPrompt"
      class="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4"
    >
      <div class="w-2 h-2 rounded-full shrink-0 bg-primary" />
      <UIcon
        name="i-lucide-bell-ring"
        class="w-10 h-10 text-primary shrink-0"
      />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium">
          Enable notifications?
        </p>
        <p class="text-xs text-muted mt-0.5">
          Get notified when friends like or comment on your photos.
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          @click="dismissPrompt"
        >
          Later
        </UButton>
        <UButton
          color="primary"
          size="xs"
          @click="enableNotifications"
        >
          Enable
        </UButton>
      </div>
    </div>

    <div
      v-if="loading && !notifications.length"
      class="space-y-4"
    >
      <div
        v-for="i in 5"
        :key="i"
        class="flex items-center gap-3 p-3"
      >
        <USkeleton class="w-10 h-10 rounded-full shrink-0" />
        <div class="flex-1 space-y-2">
          <USkeleton class="h-4 w-3/4 rounded" />
          <USkeleton class="h-3 w-1/3 rounded" />
        </div>
      </div>
    </div>

    <div
      v-else-if="!notifications.length"
      class="text-center py-16"
    >
      <UIcon
        name="i-lucide-bell-off"
        class="w-12 h-12 text-muted mx-auto mb-3"
      />
      <p class="text-muted text-sm">
        No notifications yet
      </p>
    </div>

    <div
      v-else
      class="space-y-1"
    >
      <NuxtLink
        v-for="n in notifications"
        :key="n.id"
        :to="notificationLink(n)"
        class="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted/50"
        :class="{ 'bg-primary/5': !n.isRead }"
        @click="markRead(n)"
      >
        <div
          class="w-2 h-2 rounded-full shrink-0"
          :class="n.isRead ? 'bg-transparent' : 'bg-primary'"
        />

        <UAvatar
          :src="n.actor.avatarUrl || undefined"
          :alt="n.actor.name"
          :text="n.actor.name?.slice(0, 2).toUpperCase() || '?'"
          size="sm"
        />

        <div class="flex-1 min-w-0">
          <p class="text-sm">
            <span class="font-medium">{{ n.actor.name }}</span>
            <span class="text-muted">{{ notificationText(n) }}</span>
          </p>
          <p class="text-xs text-muted mt-0.5">{{ formatRelativeTime(n.createdAt) }}</p>
        </div>

        <img
          v-if="n.photoUrl"
          :src="n.photoUrl"
          width="44"
          height="44"
          class="w-11 h-11 rounded-md object-cover shrink-0"
        >
      </NuxtLink>
    </div>

    <div
      v-if="nextCursor"
      class="flex justify-center mt-4"
    >
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        :loading="loadingMore"
        @click="loadMore"
      >
        Load more
      </UButton>
    </div>
  </div>
</template>
