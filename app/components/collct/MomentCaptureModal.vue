<script lang="ts" setup>
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'captured': [file: File, capturedAt: string]
}>()

const toast = useToast()
const { remainingSeconds } = useMoments()

const cameraInput = ref<HTMLInputElement | null>(null)

const countdownDisplay = computed(() => {
  const s = remainingSeconds.value
  const min = Math.floor(s / 60)
  const sec = s % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
})

const countdownUrgent = computed(() => remainingSeconds.value > 0 && remainingSeconds.value <= 30)

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      cameraInput.value?.click()
    })
  }
})

function triggerCamera() {
  cameraInput.value?.click()
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  emit('captured', file, new Date().toISOString())
}

function dismiss() {
  if (remainingSeconds.value > 0) {
    toast.add({
      title: 'You missed today\'s moment',
      description: 'You can still post to the feed like usual.',
      color: 'neutral',
      icon: 'i-lucide-clock'
    })
  }
  emit('update:open', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="props.open"
        class="fixed inset-0 z-[100] bg-black flex flex-col"
      >
        <!-- Countdown -->
        <div class="absolute top-0 inset-x-0 z-10 pt-[var(--safe-area-top,env(safe-area-inset-top))]">
          <div class="flex items-center justify-between px-4 py-3">
            <button
              class="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:text-white transition-colors"
              @click="dismiss"
            >
              <UIcon
                name="i-lucide-x"
                class="w-5 h-5"
              />
            </button>
            <div
              class="flex items-center gap-2 px-4 py-2 rounded-full"
              :class="countdownUrgent ? 'bg-error/20' : 'bg-black/40'"
            >
              <UIcon
                name="i-lucide-clock"
                class="w-4 h-4"
                :class="countdownUrgent ? 'text-error' : 'text-white'"
              />
              <span
                class="text-sm font-semibold tabular-nums"
                :class="countdownUrgent ? 'text-error' : 'text-white'"
              >
                {{ countdownDisplay }}
              </span>
            </div>
            <div class="w-10" />
          </div>
        </div>

        <!-- Camera viewfinder area -->
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center text-white/60 space-y-4 px-8">
            <UIcon
              name="i-lucide-camera"
              class="w-16 h-16 mx-auto text-white/30"
            />
            <p class="text-sm">
              Tap the button below to capture your moment
            </p>
          </div>
        </div>

        <!-- Shutter button -->
        <div class="absolute bottom-0 inset-x-0 pb-[calc(var(--safe-area-bottom,env(safe-area-inset-bottom))+2rem)]">
          <div class="flex justify-center">
            <button
              class="w-20 h-20 rounded-full border-4 border-white/80 bg-white/20 flex items-center justify-center transition-all active:scale-90 active:bg-white/40 hover:border-white"
              @click="triggerCamera"
            >
              <div class="w-16 h-16 rounded-full bg-white/90" />
            </button>
          </div>
        </div>

        <input
          ref="cameraInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          @change="onFileSelected"
        >
      </div>
    </Transition>
  </Teleport>
</template>
