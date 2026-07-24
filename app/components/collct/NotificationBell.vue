<script lang="ts" setup>
const route = useRoute()
const api = useApi()

const unreadCount = ref(0)

async function fetchCount() {
  try {
    const data = await api.getUnreadCount()
    unreadCount.value = data.count
  } catch {
    // Silently fail
  }
}

fetchCount()

watch(() => route.fullPath, () => {
  fetchCount()
})

defineExpose({ refresh: fetchCount })
</script>

<template>
  <NuxtLink
    to="/notifications"
    class="relative inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/50 transition-colors"
  >
    <UIcon
      name="i-lucide-bell"
      class="w-5 h-5"
    />
    <span
      v-if="unreadCount > 0"
      class="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-error rounded-full"
    >
      {{ unreadCount > 99 ? '99+' : unreadCount }}
    </span>
  </NuxtLink>
</template>
