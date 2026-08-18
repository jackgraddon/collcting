<template>
  <div
    class="relative rounded-lg border-4 overflow-hidden cursor-pointer"
    :class="activeBorder"
    @click="navigateToPost"
    @mouseenter="prefetchPost"
    @touchstart.passive="prefetchPost"
  >
    <USkeleton
      v-if="!isLoaded"
      class="absolute inset-0 w-full h-full min-h-[120px]"
    />

    <NuxtImg
      ref="imgEl"
      :src="postData.url"
      :alt="postData.caption ?? `Photo by ${postData.user.name}`"
      width="400"
      height="400"
      sizes="sm:120px md:200px lg:300px"
      format="webp"
      loading="lazy"
      decoding="async"
      class="w-full h-auto block hover:scale-[1.05] transition-transform duration-300 ease-out"
      :class="isLoaded ? 'opacity-100' : 'opacity-0'"
      :style="gridTransitionName ? { viewTransitionName: gridTransitionName } : undefined"
      @load="isLoaded = true"
    />

    <div class="absolute top-2 left-2 z-10">
      <UAvatar
        :src="postData.user?.avatarUrl ?? undefined"
        :alt="postData.user?.name"
        :text="postData.user?.name?.slice(0, 2).toUpperCase() || '?'"
        size="md"
        class="ring-2 ring-white dark:ring-gray-900"
      />
    </div>

    <div
      v-if="isMoment"
      class="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-primary/90 flex items-center justify-center"
    >
      <UIcon name="i-lucide-aperture" class="w-3.5 h-3.5 text-white" />
    </div>

    <CollctPostGroupChips
      :groups="postData.groups"
      class="absolute bottom-2 left-2 right-2"
    />
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{
  postData: PostData
}>()

const router = useRouter()
const imgEl = ref<Record<string, unknown> | null>(null)
const isLoaded = ref(false)
const colorMode = useColorMode()
const { returningPhotoId } = useViewTransition()

const isMoment = computed(() => !!props.postData.isMoment)

const themeBorders: Record<string, string> = {
  light: 'border-neutral-100',
  dark: 'border-neutral-700'
}

const momentBorders: Record<string, string> = {
  light: 'border-sunflower-gold-400',
  dark: 'border-sunflower-gold-600'
}

const activeBorder = computed(() => {
  const borders = isMoment.value ? momentBorders : themeBorders
  return borders[colorMode.value] || borders.light
})

const gridTransitionName = computed(() => {
  if (returningPhotoId.value === props.postData.id) {
    return `photo-${props.postData.id}`
  }
  return undefined
})

let prefetched = false

function prefetchPost() {
  if (prefetched) return
  prefetched = true
  import(`~/pages/post/[id].vue`).catch(() => {})
}

async function navigateToPost() {
  const el = imgEl.value?.$el as HTMLElement | undefined
  const thumbnailUrl = (el as HTMLImageElement | undefined)?.currentSrc || props.postData.url
  const pushState = {
    path: `/post/${props.postData.id}`,
    state: {
      preloadedPost: JSON.stringify(props.postData),
      thumbnailUrl
    }
  }

  if (el && supportsViewTransitionMorph()) {
    el.style.viewTransitionName = `photo-${props.postData.id}`
    const transition = document.startViewTransition(async () => {
      await router.push(pushState)
      await nextTick()
    })
    transition.finished.then(() => {
      el.style.viewTransitionName = ''
    })
  } else if (supportsViewTransitions()) {
    document.startViewTransition(async () => {
      await router.push(pushState)
      await nextTick()
    })
  } else {
    router.push(pushState)
  }
}
</script>
