<script setup>
const route = useRoute()
const router = useRouter()
const { open: momentOpen, openMomentModal, closeModal: closeMomentModal } = useMomentCaptureModal()

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
    openMomentModal()
    router.replace({ query: {} })
  }
}, { immediate: true })
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
      @uploaded="closeMomentModal"
    />
  </UApp>
</template>
