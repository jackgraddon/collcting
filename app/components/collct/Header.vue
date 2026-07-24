<template>
  <UHeader
    class="border-b-0"
    mode="slideover"
  >
    <template #left>
      <NuxtLink
        to="/"
        class="text-lg font-bold"
      >
        Collct
      </NuxtLink>
      <UNavigationMenu
        :items="items"
        variant="link"
      />
    </template>
    <template #right>
      <CollctNotificationBell />
      <UButton
        label="Post"
        icon="i-solar-add-circle-linear"
        @click="() => { uploadModal = true }"
      />
      <CollctAccountSwitcher />
      <UColorModeButton />
    </template>
    <template #body>
      <UNavigationMenu
        :items="items"
        orientation="vertical"
      />
    </template>
  </UHeader>

  <CollctUploadModal
    v-model:open="uploadModal"
    @uploaded="onUploaded"
  />
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const { emit } = useUploadBus()

const uploadModal = ref(false)

const items = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Feed',
    icon: 'solar:home-smile-angle-linear',
    to: '/',
    active: route.path === '/'
  },
  {
    label: 'Groups',
    icon: 'solar:users-group-rounded-linear',
    to: '/groups',
    active: route.path.startsWith('/groups')
  },
  {
    label: 'Settings',
    icon: 'solar:settings-minimalistic-linear',
    to: '/settings',
    active: route.path.startsWith('/settings')
  }
])

function onUploaded(post: PostData) {
  uploadModal.value = false
  emit(post)
}
</script>
