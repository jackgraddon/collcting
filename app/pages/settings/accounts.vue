<script setup lang="ts">
// Auth handled by global middleware
const router = useRouter()
const { accounts, activeAccountId, removeAccount, switchAccount } = useAccounts()

function handleRemoveAccount(id: string) {
  removeAccount(id)
  if (accounts.value.length === 0) {
    router.push('/login')
  }
}
</script>

<template>
  <div class="w-full max-w-lg mx-auto py-8">
    <div class="space-y-4">
      <UCard
        v-for="account in accounts"
        :key="account.id"
        :class="{ 'ring-2 ring-primary': account.id === activeAccountId }"
      >
        <div class="flex items-center gap-4">
          <UAvatar
            :src="account.user?.avatarUrl ?? undefined"
            :alt="account.user?.name ?? account.name"
            size="lg"
          />
          <div class="flex-1 min-w-0">
            <p class="font-semibold truncate">
              {{ account.user?.name ?? account.name }}
            </p>
            <p class="text-sm text-muted truncate">
              {{ account.serverUrl }}
            </p>
            <p class="text-xs text-muted">
              @{{ account.user?.username ?? 'unknown' }}
            </p>
          </div>
          <div class="flex gap-2">
            <UButton
              v-if="account.id !== activeAccountId"
              label="Switch"
              variant="subtle"
              size="sm"
              @click="switchAccount(account.id)"
            />
            <UBadge
              v-else
              label="Active"
              color="primary"
              variant="subtle"
            />
            <UButton
              icon="solar:trash-bin-minimalistic-linear"
              variant="ghost"
              color="error"
              size="sm"
              @click="handleRemoveAccount(account.id)"
            />
          </div>
        </div>
      </UCard>

      <UButton
        label="Add Account"
        icon="solar:add-circle-linear"
        variant="subtle"
        block
        to="/login"
      />
    </div>
  </div>
</template>
