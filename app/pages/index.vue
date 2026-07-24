<script lang="ts" setup>
import { useIntersectionObserver } from '@vueuse/core'

const { on } = useUploadBus()
const api = useApi()

interface FeedState {
  photos: PostData[]
  nextCursor: number | null
}

const feedState = ref<FeedState | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const loadMoreTrigger = ref(null)

const appendedPosts = ref<PostData[]>([])
const pendingNewPosts = ref<PostData[]>([])
const newPostCount = computed(() => pendingNewPosts.value.length)

const { pullDistance, refreshing: ptrRefreshing } = usePullToRefresh(async () => {
  pendingNewPosts.value = []
  const fresh = await api.getFeed({ limit: 20 })
  feedState.value = fresh
})

const visiblePosts = computed(() => [
  ...appendedPosts.value,
  ...pendingNewPosts.value,
  ...(feedState.value?.photos ?? [])
])

const exhausted = computed(() => feedState.value?.nextCursor === null)

async function loadInitial() {
  loading.value = true
  try {
    feedState.value = await api.getFeed({ limit: 20 })
  } finally {
    loading.value = false
  }
}

async function checkForNewPosts() {
  if (!feedState.value?.photos.length) return
  try {
    const newest = feedState.value.photos[0]
    if (!newest) return
    const newestTime = new Date(newest.createdAt).getTime() + 1
    const newer = await api.getFeed({ limit: 50, after: newestTime })
    if (newer.photos.length) {
      pendingNewPosts.value = newer.photos
    }
  } catch {
    // Silently ignore
  }
}

function showNewPosts() {
  if (feedState.value && pendingNewPosts.value.length) {
    feedState.value = {
      ...feedState.value,
      photos: [...pendingNewPosts.value, ...feedState.value.photos]
    }
    pendingNewPosts.value = []
  }
}

async function loadMore() {
  if (loadingMore.value || !feedState.value?.nextCursor) return
  loadingMore.value = true
  try {
    const result = await api.getFeed({ limit: 20, before: feedState.value.nextCursor })
    if (feedState.value) {
      feedState.value = {
        photos: [...feedState.value.photos, ...result.photos],
        nextCursor: result.nextCursor
      }
    }
  } finally {
    loadingMore.value = false
  }
}

onMounted(async () => {
  await loadInitial()
  await checkForNewPosts()
})

onActivated(() => {
  checkForNewPosts()
})

on(post => appendedPosts.value.unshift(post))

useIntersectionObserver(
  loadMoreTrigger,
  (entries) => {
    const isIntersecting = entries[0]?.isIntersecting
    if (isIntersecting && !loadingMore.value && !exhausted.value) {
      loadMore()
    }
  },
  { threshold: 0.5 }
)
</script>

<template>
  <UContainer class="py-6">
    <!-- Pull to refresh indicator -->
    <div
      class="flex justify-center overflow-hidden transition-all duration-200"
      :style="{ height: pullDistance ? `${pullDistance}px` : ptrRefreshing ? '40px' : '0px' }"
    >
      <div class="flex items-center justify-center py-2">
        <UIcon
          name="i-lucide-refresh-cw"
          :class="{ 'animate-spin': ptrRefreshing }"
          class="w-5 h-5 text-muted transition-opacity"
          :style="{ opacity: Math.min((pullDistance || (ptrRefreshing ? 40 : 0)) / 40, 1) }"
        />
      </div>
    </div>

    <!-- New posts banner -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <button
        v-if="newPostCount > 0"
        class="w-full mb-4 py-2 px-4 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
        @click="showNewPosts"
      >
        {{ newPostCount }} new {{ newPostCount === 1 ? 'post' : 'posts' }} — tap to see
      </button>
    </Transition>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex justify-center py-12"
    >
      <UProgress />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="visiblePosts.length === 0"
      class="text-center py-12 text-muted"
    >
      <p class="text-lg">
        No photos yet
      </p>
      <p class="text-sm mt-2">
        When your friends post photos, they'll appear here.
      </p>
    </div>

    <!-- Feed grid -->
    <CollctPostGrid
      v-else
      v-slot="{ post }"
      :posts="visiblePosts"
    >
      <CollctPostGridItem :post-data="post" />
    </CollctPostGrid>

    <!-- Load more trigger -->
    <div
      ref="loadMoreTrigger"
      class="h-10 w-full flex items-center justify-center mt-4"
    >
      <USkeleton
        v-if="loadingMore"
        class="h-8 w-32"
      />
      <p
        v-else-if="exhausted && visiblePosts.length > 0"
        class="text-sm text-neutral-400"
      >
        You're all caught up!
      </p>
    </div>
  </UContainer>
</template>
