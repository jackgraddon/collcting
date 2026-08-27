<script lang="ts" setup>
import { useIntersectionObserver } from '@vueuse/core'

const { canCapture, activeSupported, isActive, activeAccountDrafts, retryAllDrafts } = useMoments()
const { openMomentModal } = useMomentCaptureModal()

const {
  photos,
  nextCursor,
  isLoading,
  loadInitial,
  loadMore: loadMoreFeed,
  refresh,
  startPolling
} = useFeedPolling()

const loadMoreTrigger = ref(null)

const { pullDistance, refreshing: ptrRefreshing } = usePullToRefresh(async () => {
  await refresh()
})

const exhausted = computed(() => nextCursor.value === null)

const showMomentBanner = computed(() => activeSupported.value && canCapture.value && isActive.value)
const hasActiveDrafts = computed(() => activeAccountDrafts.value.length > 0)

async function retryDrafts() {
  await retryAllDrafts()
}

const loadingMore = ref(false)

async function loadMore() {
  if (loadingMore.value || !nextCursor.value) return
  loadingMore.value = true
  try {
    await loadMoreFeed()
  } finally {
    loadingMore.value = false
  }
}

onMounted(async () => {
  await loadInitial()
  startPolling()
})

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
  <div class="w-full mx-auto py-6">
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

    <!-- Moment capture banner -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <button
        v-if="showMomentBanner"
        class="w-full mb-4 p-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 text-center transition-colors hover:bg-primary/10"
        @click="openMomentModal"
      >
        <div class="flex items-center justify-center gap-2 mb-1">
          <UIcon
            name="i-lucide-aperture"
            class="w-5 h-5 text-primary"
          />
          <span class="font-semibold text-primary">Moment is active!</span>
        </div>
        <p class="text-sm text-muted">
          Tap to capture your moment
        </p>
      </button>
    </Transition>

    <!-- Draft retry indicator -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="hasActiveDrafts"
        class="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-lg bg-warning/5 border border-warning/20"
      >
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-cloud-off"
            class="w-4 h-4 text-warning shrink-0"
          />
          <span class="text-sm text-muted">Moment capture pending — will retry automatically</span>
        </div>
        <UButton
          color="warning"
          variant="ghost"
          size="xs"
          @click="retryDrafts"
        >
          Retry now
        </UButton>
      </div>
    </Transition>

    <!-- Loading -->
    <div
      v-if="isLoading"
      class="flex justify-center py-12"
    >
      <UProgress />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="photos.length === 0"
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
      :posts="photos"
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
        v-else-if="exhausted && photos.length > 0"
        class="text-sm text-neutral-400"
      >
        You're all caught up!
      </p>
    </div>
  </div>
</template>
