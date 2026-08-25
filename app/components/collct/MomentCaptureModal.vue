<script lang="ts" setup>
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'uploaded': [post: PostData]
}>()

const toast = useToast()
const api = useApi()
const { activeAccount } = useAccounts()
const { activeState, remainingSeconds, saveDraft } = useMoments()

const cameraInput = ref<HTMLInputElement | null>(null)
const capturedPhoto = ref<File | null>(null)
const capturedPreview = ref<string | null>(null)
const capturedAt = ref<string>('')
const uploading = ref(false)
const compressing = ref(false)
const phase = ref<'camera' | 'groups'>('camera')

const groupsData = ref<{ groups: GroupData[] } | null>(null)
const loadingGroups = ref(false)
const selectedGroupIds = ref<number[]>([])

const momentGroups = computed(() => activeState.value?.userMomentsGroups ?? [])

const countdownDisplay = computed(() => {
  const s = remainingSeconds.value
  const min = Math.floor(s / 60)
  const sec = s % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
})

const countdownUrgent = computed(() => remainingSeconds.value > 0 && remainingSeconds.value <= 30)

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    phase.value = 'camera'
    capturedPhoto.value = null
    capturedPreview.value = null
    capturedAt.value = ''
    selectedGroupIds.value = []
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

  capturedPhoto.value = file
  capturedAt.value = new Date().toISOString()
  capturedPreview.value = URL.createObjectURL(file)
  phase.value = 'groups'
  loadGroups()
}

async function loadGroups() {
  loadingGroups.value = true
  try {
    groupsData.value = await api.getGroups()
  } catch {
    groupsData.value = { groups: [] }
  } finally {
    loadingGroups.value = false
  }
}

function dismiss() {
  if (remainingSeconds.value > 0 && !capturedPhoto.value) {
    toast.add({
      title: 'You missed today\'s moment',
      description: 'You can still post to the feed like usual.',
      color: 'neutral',
      icon: 'i-lucide-clock'
    })
  }
  close()
}

function close() {
  if (capturedPreview.value) {
    URL.revokeObjectURL(capturedPreview.value)
  }
  capturedPhoto.value = null
  capturedPreview.value = null
  capturedAt.value = ''
  phase.value = 'camera'
  selectedGroupIds.value = []
  emit('update:open', false)
}

async function postCapture() {
  if (!capturedPhoto.value || !activeAccount.value) return

  uploading.value = true
  try {
    compressing.value = true
    const photo = await compressImage(capturedPhoto.value)
    compressing.value = false

    const form = new FormData()
    form.append('photo', photo)
    form.append('groupIds', JSON.stringify(selectedGroupIds.value))
    form.append('isMoment', 'true')

    const post = await api.uploadPhoto(form)

    toast.add({ title: 'Moment captured', color: 'success', icon: 'i-lucide-circle-check' })
    emit('uploaded', post as unknown as PostData)
    close()
  } catch {
    const draft: MomentDraft = {
      id: crypto.randomUUID(),
      accountId: activeAccount.value.id,
      serverUrl: activeAccount.value.serverUrl,
      photo: capturedPhoto.value,
      capturedAt: capturedAt.value,
      selectedGroupIds: [...selectedGroupIds.value],
      createdAt: Date.now(),
      status: 'pending',
      attempts: 0
    }

    await saveDraft(draft)

    toast.add({
      title: 'Moment capture saved',
      description: 'Will retry when connection is restored.',
      color: 'warning',
      icon: 'i-lucide-cloud-off'
    })
    close()
  } finally {
    compressing.value = false
    uploading.value = false
  }
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
        <!-- Camera phase -->
        <template v-if="phase === 'camera'">
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
        </template>

        <!-- Group selection phase -->
        <template v-if="phase === 'groups'">
          <div class="flex flex-col h-full bg-white dark:bg-neutral-900">
            <!-- Header -->
            <div class="flex items-center justify-between px-4 py-3 border-b border-default shrink-0 pt-[calc(var(--safe-area-top,env(safe-area-inset-top))+0.75rem)]">
              <button
                class="text-sm text-muted hover:text-default transition-colors"
                @click="phase = 'camera'; capturedPhoto = null; capturedPreview = null"
              >
                Retake
              </button>
              <span class="text-sm font-semibold">Share moment</span>
              <button
                class="text-sm font-medium text-primary disabled:opacity-50"
                :disabled="uploading || selectedGroupIds.length === 0"
                @click="postCapture"
              >
                {{ uploading ? (compressing ? 'Processing...' : 'Posting...') : 'Post' }}
              </button>
            </div>

            <!-- Preview & groups -->
            <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div
                v-if="capturedPreview"
                class="rounded-xl overflow-hidden border-2 border-primary/30"
              >
                <img
                  :src="capturedPreview"
                  alt="Captured moment"
                  class="w-full max-h-64 object-cover"
                >
              </div>

              <div
                v-if="loadingGroups"
                class="flex justify-center py-4"
              >
                <UProgress />
              </div>

              <div
                v-else-if="momentGroups.length > 0"
                class="space-y-2"
              >
                <p class="text-xs font-medium text-muted uppercase tracking-wider">
                  Share to
                </p>
                <div class="space-y-1.5">
                  <label
                    v-for="group in momentGroups"
                    :key="group.id"
                    class="flex items-center gap-2.5 cursor-pointer"
                  >
                    <UCheckbox
                      :model-value="selectedGroupIds.includes(group.id)"
                      @update:model-value="(val: boolean | 'indeterminate') => {
                        if (val === true) {
                          selectedGroupIds.push(group.id)
                        }
                        else if (val === false) {
                          selectedGroupIds = selectedGroupIds.filter(id => id !== group.id)
                        }
                      }"
                    />
                    <span class="text-sm text-default">{{ group.name }}</span>
                  </label>
                </div>
                <p class="text-xs text-muted">
                  Only groups with moments enabled are shown.
                </p>
              </div>

              <div
                v-else-if="!loadingGroups"
                class="text-center py-8 text-muted"
              >
                <UIcon
                  name="i-lucide-users"
                  class="w-10 h-10 mx-auto mb-2 text-muted/50"
                />
                <p class="text-sm">
                  No groups available for moments
                </p>
              </div>
            </div>
          </div>
        </template>

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
