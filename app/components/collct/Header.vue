<template>
  <header class="sticky top-0 z-50 shrink-0">
    <div class="absolute inset-x-0 -top-[var(--safe-area-top,env(safe-area-inset-top))] bottom-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl" />

    <div
      class="relative flex items-center justify-between px-4 min-h-12 py-2"
      :class="safeAreaTop ? 'pt-[var(--safe-area-top,env(safe-area-inset-top))]' : ''"
    >
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
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

withDefaults(defineProps<{
  // False when another element (e.g. the beta banner) already sits in the
  // top safe area above the header. The background extension stays so the
  // safe strip is covered once the header sticks on scroll.
  safeAreaTop?: boolean
}>(), {
  safeAreaTop: true
})

const route = useRoute()
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
</script>
