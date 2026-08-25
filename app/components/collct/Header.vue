<template>
  <header class="sticky top-0 z-50 shrink-0">
    <div class="absolute inset-x-0 -top-[var(--safe-area-top,env(safe-area-inset-top))] bottom-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl" />

    <div class="relative flex items-center justify-between px-4 min-h-12 py-2 pt-[var(--safe-area-top,env(safe-area-inset-top))]">
      <NuxtLink
        to="/"
        class="flex items-center gap-2"
      >
        <NuxtImg
          src="/app-icon-clear.png"
          alt="Collct"
          width="28"
          height="28"
          class="rounded-lg"
        />
        <span class="text-base font-bold">Collct<span class="text-primary">ing</span></span>
      </NuxtLink>

      <UNavigationMenu
        :items="items"
        variant="link"
        class="hidden lg:flex"
      />

      <div class="flex items-center gap-2">
        <CollctNotificationBell />
        <UButton
          v-if="accounts.length > 0"
          label="Post"
          icon="i-solar-add-circle-linear"
          class="hidden lg:flex"
          @click="uploadModal.openModal()"
        />
        <div class="hidden lg:block">
          <CollctAccountSwitcher />
        </div>
      </div>
    </div>
  </header>

  <CollctUploadModal
    v-model:open="uploadModal.open.value"
    @uploaded="onUploaded"
  />
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const { emit } = useUploadBus()
const uploadModal = useUploadModal()
const { accounts } = useAccounts()

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
  uploadModal.closeModal()
  emit(post)
}
</script>
