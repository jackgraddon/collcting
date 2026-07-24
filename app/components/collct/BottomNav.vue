<script lang="ts" setup>
const router = useRouter()
const { accounts, activeAccount, switchAccount } = useAccounts()
const uploadModal = useUploadModal()

const menuOpen = ref(false)

function handleSwitch(id: string) {
  switchAccount(id)
  menuOpen.value = false
  router.push('/')
}

function goTo(path: string) {
  menuOpen.value = false
  router.push(path)
}
</script>

<template>
  <nav class="fixed bottom-0 inset-x-0 z-50 lg:hidden border-t border-muted bg-[var(--ui-bg)] pb-[env(safe-area-inset-bottom)]">
    <div class="flex items-center justify-around h-14">
      <NuxtLink
        to="/"
        class="flex flex-col items-center justify-center gap-0.5 w-16 h-full text-muted transition-colors"
        active-class="!text-primary"
      >
        <UIcon
          name="solar:home-smile-angle-bold"
          class="size-6"
        />
        <span class="text-[10px] font-medium">Feed</span>
      </NuxtLink>

      <button
        class="flex flex-col items-center justify-center gap-0.5 w-16 h-full text-muted transition-colors hover:text-default"
        @click="uploadModal.openModal()"
      >
        <UIcon
          name="solar:add-circle-bold"
          class="size-6"
        />
        <span class="text-[10px] font-medium">Post</span>
      </button>

      <NuxtLink
        to="/groups"
        class="flex flex-col items-center justify-center gap-0.5 w-16 h-full text-muted transition-colors"
        active-class="!text-primary"
      >
        <UIcon
          name="solar:users-group-rounded-bold"
          class="size-6"
        />
        <span class="text-[10px] font-medium">Groups</span>
      </NuxtLink>

      <UDropdownMenu
        v-model:open="menuOpen"
        :items="[
          { label: 'Settings', icon: 'solar:settings-minimalistic-bold', onSelect: () => goTo('/settings') },
          { type: 'separator' },
          ...accounts.map(a => ({
            label: a.name || (a.user?.username ?? a.serverUrl),
            avatar: { src: a.user?.avatarUrl ?? undefined, alt: a.name || a.user?.username },
            suffix: a.serverUrl,
            active: a.id === activeAccount?.id,
            onSelect: () => handleSwitch(a.id)
          })),
          { label: 'Add account', icon: 'solar:add-circle-bold', onSelect: () => goTo('/login') }
        ]"
        :content="{ align: 'center', side: 'top' }"
      >
        <button class="flex flex-col items-center justify-center gap-0.5 w-16 h-full text-muted transition-colors hover:text-default">
          <UAvatar
            :src="activeAccount?.user?.avatarUrl ?? undefined"
            :alt="activeAccount?.name || activeAccount?.user?.username"
            size="xs"
          />
          <span class="text-[10px] font-medium">Profile</span>
        </button>
      </UDropdownMenu>
    </div>
  </nav>
</template>
