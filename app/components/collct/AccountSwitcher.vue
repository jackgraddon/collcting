<script lang="ts" setup>
const { accounts, activeAccount, switchAccount } = useAccounts()
const router = useRouter()

const open = ref(false)

function handleSwitch(id: string) {
  switchAccount(id)
  open.value = false
  router.push('/')
}

function goToAddAccount() {
  open.value = false
  router.push('/login')
}
</script>

<template>
  <UDropdownMenu
    v-model:open="open"
    :items="[
      ...accounts.map(a => ({
        label: a.name || (a.user?.username ?? a.serverUrl),
        avatar: { src: a.user?.avatarUrl ?? undefined, alt: a.name || a.user?.username },
        suffix: a.serverUrl,
        active: a.id === activeAccount?.id,
        onSelect: () => handleSwitch(a.id)
      })),
      { type: 'separator' },
      { label: 'Add account', icon: 'solar:add-circle-linear', onSelect: goToAddAccount },
      { label: 'Manage accounts', icon: 'solar:settings-linear', onSelect: () => { open.value = false; router.push('/settings/accounts') } }
    ]"
    :content="{ align: 'start' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
    >
      <UAvatar
        :src="activeAccount?.user?.avatarUrl ?? undefined"
        :alt="activeAccount?.name || activeAccount?.user?.username"
        size="xs"
      />
      <span class="ml-1 max-w-[8rem] truncate">
        {{ activeAccount?.name || activeAccount?.user?.username }}
      </span>
      <UIcon
        name="solar:alt-down-bold"
        class="ml-1 size-4 shrink-0"
      />
    </UButton>
  </UDropdownMenu>
</template>
