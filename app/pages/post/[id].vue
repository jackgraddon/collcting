<script lang="ts" setup>
const route = useRoute()
const id = Number(route.params.id)
const api = useApi()
const router = useRouter()
const toast = useToast()

const preloaded = ref<PostData | null>(import.meta.client
  ? (() => {
      const s = history.state as Record<string, unknown>
      const raw = s?.preloadedPost
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw) as PostData
        } catch {
          return null
        }
      }
      return (raw as PostData) ?? null
    })()
  : null)
const thumbnailUrl = ref<string | null>(import.meta.client ? ((history.state as Record<string, unknown>).thumbnailUrl as string) ?? preloaded.value?.url ?? null : preloaded.value?.url ?? null)

const freshPost = ref<PostData | null>(null)
const loadingFresh = ref(true)

const post = computed(() => freshPost.value ?? preloaded.value)

const { activeAccount } = useAccounts()
const currentUser = computed(() => activeAccount.value?.user)
const isOwner = computed(() => currentUser.value?.id === post.value?.user.id)
const isLoggedIn = computed(() => !!currentUser.value)
const { setReturning, clearReturning } = useViewTransition()

function goBack() {
  if (supportsViewTransitionMorph()) {
    setReturning(id)
    document.startViewTransition(async () => {
      await router.push('/')
      await nextTick()
    }).finished.then(() => clearReturning())
  } else if (supportsViewTransitions()) {
    document.startViewTransition(() => {
      history.back()
    })
  } else {
    history.back()
  }
}

onMounted(async () => {
  try {
    freshPost.value = await api.getPhoto(id)
  } catch {
    // preloaded will be used as fallback
  } finally {
    loadingFresh.value = false
  }
})

const parseSafeDate = (dateVal: string | Date | null | undefined): Date => {
  if (!dateVal) return new Date()
  if (dateVal instanceof Date) return dateVal
  if (typeof dateVal === 'string') {
    const normalized = dateVal.includes('T') ? dateVal : dateVal.replace(' ', 'T')
    return new Date(normalized)
  }
  return new Date(dateVal)
}

const formattedDate = computed(() => {
  if (!post.value?.createdAt) return ''
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(parseSafeDate(post.value.createdAt))
})

function formatEditDate(isoString: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(parseSafeDate(isoString))
}

const deleteModal = ref(false)
const deleting = ref(false)

async function confirmDelete() {
  deleting.value = true
  try {
    await api.deletePhoto(id)
    toast.add({ title: 'Photo deleted', color: 'success', icon: 'solar:check-circle-bold' })
    router.push('/')
  } catch {
    toast.add({ title: 'Failed to delete photo', color: 'error', icon: 'solar:danger-triangle-bold' })
  } finally {
    deleting.value = false
    deleteModal.value = false
  }
}

function share() {
  navigator.clipboard.writeText(window.location.href)
  toast.add({ title: 'Link copied', color: 'neutral', icon: 'solar:link-linear' })
}

const liked = ref(false)
const likeCount = ref<number | null>(null)
const liking = ref(false)

async function fetchLikes() {
  const data = await api.getLikes(id)
  if (!liking.value) liked.value = data.liked
  likeCount.value = data.count
}

async function toggleLike() {
  if (!isLoggedIn.value || liking.value) return
  liking.value = true

  liked.value = !liked.value
  if (likeCount.value !== null) {
    likeCount.value += liked.value ? 1 : -1
  }

  try {
    const result = await api.toggleLike(id)
    liked.value = result.liked
    likeCount.value = result.count
  } catch {
    liked.value = !liked.value
    if (likeCount.value !== null) {
      likeCount.value += liked.value ? 1 : -1
    }
    toast.add({ title: 'Could not update like', color: 'error', icon: 'solar:danger-triangle-bold' })
  } finally {
    liking.value = false
  }
}

const editingCaption = ref(false)
const editedCaption = ref('')
const savingCaption = ref(false)
const captionHistoryModal = ref(false)

function startEditCaption() {
  editedCaption.value = post.value?.caption ?? ''
  editingCaption.value = true
}

function cancelEditCaption() {
  editingCaption.value = false
  editedCaption.value = ''
}

async function saveCaption() {
  if (!post.value) return
  savingCaption.value = true
  try {
    const updated = await api.editCaption(id, editedCaption.value || null)
    const merged = { ...post.value, ...updated }
    preloaded.value = merged
    freshPost.value = updated
    editingCaption.value = false
    toast.add({ title: 'Caption updated', color: 'success', icon: 'solar:check-circle-bold' })
  } catch {
    toast.add({ title: 'Could not update caption', color: 'error', icon: 'solar:danger-triangle-bold' })
  } finally {
    savingCaption.value = false
  }
}

const POLL_INTERVAL = 10_000
let likesTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  if (likesTimer) return
  likesTimer = setInterval(fetchLikes, POLL_INTERVAL)
}

function stopPolling() {
  if (likesTimer) clearInterval(likesTimer)
  likesTimer = null
}

onMounted(async () => {
  await fetchLikes()
  startPolling()

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling()
    } else {
      fetchLikes()
      startPolling()
    }
  })
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <UContainer class="py-10 max-w-4xl">
    <div
      v-if="!post && loadingFresh"
      class="space-y-6"
    >
      <div class="flex items-center gap-3">
        <USkeleton class="w-10 h-10 rounded-full" />
        <div class="space-y-2">
          <USkeleton class="h-4 w-32 rounded" />
          <USkeleton class="h-3 w-24 rounded" />
        </div>
      </div>
      <USkeleton
        class="w-full rounded-xl"
        style="aspect-ratio: 4/3"
      />
    </div>

    <UAlert
      v-else-if="!post"
      color="error"
      variant="soft"
      icon="solar:danger-triangle-bold"
      title="Photo not found"
      description="This photo may have been deleted or doesn't exist."
    >
      <template #footer>
        <UButton
          to="/"
          color="error"
          variant="ghost"
          size="sm"
        >
          Back to feed
        </UButton>
      </template>
    </UAlert>

    <div
      v-else
      class="space-y-6 lg:space-y-0 lg:flex lg:gap-8 lg:min-h-[calc(100dvh-8rem)]"
    >
      <div class="lg:flex-1 lg:min-w-0 order-2 lg:order-1 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100dvh-8rem)]">
        <NuxtImg
          v-if="post"
          :src="freshPost ? post.url : (thumbnailUrl || post.url)"
          :alt="post.caption || `Photo by ${post.user.name}`"
          sizes="sm:100vw md:800px lg:50vw"
          format="webp"
          decoding="async"
          class="max-h-[calc(100dvh-12rem)] lg:max-h-full w-auto max-w-full object-contain rounded-xl mx-auto block"
          :style="supportsViewTransitionMorph() ? { viewTransitionName: `photo-${post.id}` } : undefined"
        />
        <USkeleton
          v-else
          class="w-full rounded-xl"
          style="aspect-ratio: 4/3"
        />
      </div>

      <div class="lg:flex-1 lg:min-w-0 space-y-6 order-1 lg:order-2">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <UButton
              color="neutral"
              variant="ghost"
              icon="solar:arrow-left-linear"
              size="sm"
              @click="goBack"
            />
            <UAvatar
              :src="post.user.avatarUrl || undefined"
              :alt="post.user.name"
              :text="post.user.name.slice(0, 2).toUpperCase()"
            />
            <div class="min-w-0">
              <ULink
                :to="`/user/${post.user.username}`"
                class="font-semibold text-sm hover:text-primary transition-colors truncate block"
              >
                {{ post.user.name }}
              </ULink>
              <p class="text-muted text-xs">
                {{ formattedDate }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <UButton
              color="neutral"
              variant="ghost"
              icon="solar:link-linear"
              size="sm"
              @click="share"
            >
              Share
            </UButton>
            <UButton
              v-if="isOwner"
              color="error"
              variant="ghost"
              icon="solar:trash-bin-minimalistic-linear"
              size="sm"
              @click="() => { deleteModal = true }"
            >
              Delete
            </UButton>
          </div>
        </div>

        <CollctPostGroupChips :groups="post.groups" />

        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0 space-y-1">
            <template v-if="!editingCaption">
              <p
                v-if="post.caption"
                class="text-base text-default whitespace-pre-wrap selectable"
              >
                {{ post.caption }}
              </p>
              <p
                v-else
                class="text-sm text-muted italic"
              >
                No caption
              </p>

              <button
                v-if="post.captionEditedAt"
                class="text-xs text-muted hover:text-default transition-colors"
                @click="() => { captionHistoryModal = true }"
              >
                (edited)
              </button>

              <button
                v-if="isOwner"
                class="text-xs text-primary hover:text-primary/80 transition-colors"
                @click="startEditCaption"
              >
                Edit caption
              </button>
            </template>

            <template v-else>
              <UTextarea
                v-model="editedCaption"
                placeholder="Write a caption…"
                :rows="3"
                :maxlength="500"
                class="w-full"
              />
              <div class="flex items-center gap-2">
                <UButton
                  size="xs"
                  :loading="savingCaption"
                  @click="saveCaption"
                >
                  Save
                </UButton>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :disabled="savingCaption"
                  @click="cancelEditCaption"
                >
                  Cancel
                </UButton>
              </div>
            </template>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <span
              v-if="isOwner && likeCount !== null"
              class="text-sm text-muted tabular-nums"
            >
              {{ likeCount }} {{ likeCount === 1 ? 'like' : 'likes' }}
            </span>

            <UButton
              :color="liked ? 'error' : 'neutral'"
              :variant="liked ? 'soft' : 'ghost'"
              size="sm"
              :loading="liking"
              :disabled="!isLoggedIn"
              :title="isLoggedIn ? (liked ? 'Unlike' : 'Like') : 'Sign in to like'"
              @click="toggleLike"
            >
              <template #leading>
                <UIcon
                  name="i-lucide-heart"
                  :class="liked ? 'fill-current text-error' : 'text-muted'"
                  class="w-4 h-4"
                />
              </template>
            </UButton>
          </div>
        </div>

        <CollctPostComments
          :photo-id="id"
          :is-logged-in="isLoggedIn"
          :session-user-id="currentUser?.id ?? null"
          :user="currentUser ? { avatarUrl: currentUser.avatarUrl, name: currentUser.name } : null"
        />
      </div>
    </div>

    <UModal
      v-if="deleteModal"
      v-model:open="deleteModal"
    >
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="solar:trash-bin-minimalistic-linear"
                class="text-error w-5 h-5"
              />
              <span class="font-semibold">Delete photo?</span>
            </div>
          </template>

          <p class="text-muted text-sm">
            This will permanently delete the photo and cannot be undone.
          </p>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                @click="() => { deleteModal = false }"
              >
                Cancel
              </UButton>
              <UButton
                color="error"
                variant="solid"
                :loading="deleting"
                @click="confirmDelete"
              >
                Delete
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal
      v-if="captionHistoryModal"
      v-model:open="captionHistoryModal"
    >
      <template #content>
        <UCard>
          <template #header>
            <span class="font-semibold">Caption History</span>
          </template>

          <div
            v-if="post?.captionHistory?.length"
            class="space-y-3 max-h-64 overflow-y-auto"
          >
            <div
              v-for="(version, idx) in post.captionHistory"
              :key="idx"
              class="border-l-2 border-default pl-3 py-2"
            >
              <p class="text-xs text-muted">
                {{ formatEditDate(version.editedAt) }}
                <span
                  v-if="idx === post.captionHistory!.length - 1"
                  class="ml-2 text-primary"
                >
                  (current)
                </span>
              </p>
              <p class="text-sm text-default whitespace-pre-wrap mt-1">
                {{ version.text ?? '(no caption)' }}
              </p>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end">
              <UButton
                color="neutral"
                variant="ghost"
                @click="() => { captionHistoryModal = false }"
              >
                Close
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UContainer>
</template>
