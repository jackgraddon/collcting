<script setup>
const route = useRoute()
const router = useRouter()
const { emit: emitUpload } = useUploadBus()
const { open: momentOpen, openMomentModal, onCaptured } = useMomentCaptureModal()
const uploadModal = useUploadModal()
const { canCapture, isActive, capturedToday, refreshActive } = useMoments()
const toast = useToast()
const { public: { isBeta } } = useRuntimeConfig()
const { isNative } = usePlatform()

useHead({
  htmlAttrs: {
    lang: 'en'
  }
})

useSeoMeta({
  title: 'Collct',
  description: 'A friends-first photo sharing app. No algorithm. No tracking. No strangers.',
  ogTitle: 'Collct',
  ogDescription: 'A friends-first photo sharing app. No algorithm. No tracking. No strangers.'
})

async function handleMomentDeepLink() {
  // Strip the param first so a reload doesn't re-trigger.
  router.replace({ query: {} })
  // Moments state may be empty/stale on cold start — refresh before deciding,
  // otherwise we'd wrongly report "window has passed" and eat the deep link.
  try {
    await refreshActive()
  } catch {
    // Offline — decide on whatever state we have
  }
  if (canCapture.value) {
    openMomentModal()
  } else {
    const reason = capturedToday.value
      ? 'You already captured your moment today.'
      : !isActive.value
          ? 'The moment window has passed.'
          : 'Moment capture isn\'t available right now.'
    toast.add({
      title: 'Missed the moment',
      description: `${reason} You can still post anytime.`,
      color: 'neutral',
      icon: 'i-lucide-clock'
    })
  }
}

watch(() => route.query.moment, (val) => {
  if (val === 'capture') {
    handleMomentDeepLink()
  }
}, { immediate: true })

function onMomentCaptured(file, at) {
  onCaptured(file, at)
  uploadModal.openMomentModal(file, at)
}

function onUploaded(post) {
  emitUpload(post)
  uploadModal.closeModal()
}

// Navigation requests from the service worker (notification taps when the
// app window is already open and couldn't be navigated directly).
if (import.meta.client && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data
    if (data?.type === 'COLLCT_NAVIGATE' && typeof data.url === 'string' && data.url.startsWith('/')) {
      router.push(data.url)
    }
  })
}

onMounted(() => {
  if (!isNative.value) return

  import('@capacitor/push-notifications').then(({ PushNotifications }) => {
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const title = notification.notification?.title || 'Collct'
      const body = notification.notification?.body || ''

      toast.add({
        title,
        description: body,
        color: 'primary',
        icon: 'i-lucide-bell'
      })
    })
  })
})
</script>

<template>
  <UApp>
    <div
      v-if="isBeta"
      class="bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 text-center text-xs py-1.5 px-4"
    >
      Beta — You're using a development version. Things may break.
    </div>

    <CollctHeader />

    <UMain class="px-4 pb-[calc(3rem+var(--safe-area-bottom,env(safe-area-inset-bottom)))] lg:pb-0">
      <NuxtPage :keepalive="{ max: 10, exclude: ['login', 'settings', 'account'] }" />
    </UMain>

    <CollctBottomNav />

    <CollctMomentCaptureModal
      v-model:open="momentOpen"
      @captured="onMomentCaptured"
    />

    <CollctUploadModal
      v-model:open="uploadModal.open.value"
      :moment-mode="uploadModal.momentMode.value"
      :prefill-photo="uploadModal.prefillPhoto.value"
      :moment-captured-at="uploadModal.momentCapturedAt.value"
      @uploaded="onUploaded"
    />
  </UApp>
</template>
