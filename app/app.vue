<script setup>
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
</script>

<template>
  <UApp>
    <CollctHeader />

    <UMain class="pt-[env(safe-area-inset-top)] pb-14 lg:pb-0">
      <NuxtPage :keepalive="{ max: 10, exclude: ['login', 'settings', 'account'] }" />
    </UMain>

    <CollctBottomNav />
  </UApp>
</template>
