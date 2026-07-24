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
        label: a.user?.name ?? a.name,
        avatar: { src: a.user?.avatarUrl ?? undefined, alt: a.user?.name },
        suffix: a.serverUrl,
        active: a.id === activeAccount?.id,
        onSelect: () => handleSwitch(a.id)
      })),
      { type: 'separator' },
      { label: 'Add account', icon: 'solar:add-circle-linear', onSelect: goToAddAccount }
    ]"
    :content="{ align: 'start' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      icon="solar:alt-arrow-down-bold"
      size="sm"
    />
  </UDropdownMenu>
</template>
