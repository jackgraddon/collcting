<script setup>
const route = useRoute()
const router = useRouter()
const { emit: emitUpload } = useUploadBus()
const { open: momentOpen, openMomentModal, onCaptured } = useMomentCaptureModal()
const uploadModal = useUploadModal()
const { canCapture, isActive, capturedToday } = useMoments()
const toast = useToast()

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

watch(() => route.query.moment, (val) => {
  if (val === 'capture') {
    router.replace({ query: {} })
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
}, { immediate: true })

function onMomentCaptured(file, at) {
  onCaptured(file, at)
  uploadModal.openMomentModal(file, at)
}

function onUploaded(post) {
  emitUpload(post)
  uploadModal.closeModal()
}
</script>

<template>
  <UApp>
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
