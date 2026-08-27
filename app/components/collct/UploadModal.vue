<script lang="ts" setup>
const props = defineProps<{
  open: boolean
  momentMode?: boolean
  prefillPhoto?: File | null
  momentCapturedAt?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'uploaded': [post: PostData]
}>()

const toast = useToast()
const router = useRouter()
const api = useApi()
const { activeAccount } = useAccounts()
const { saveDraft, activeState } = useMoments()

const cameraInput = ref<HTMLInputElement | null>(null)
const libraryInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const preview = ref<string | null>(null)
const caption = ref('')
const uploading = ref(false)
const compressing = ref(false)

const groupsData = ref<{ groups: GroupData[] } | null>(null)
const loadingGroups = ref(false)
const selectedGroupIds = ref<number[]>([])
const showCreateGroupDialog = ref(false)

const nonPublicGroups = computed(() => groupsData.value?.groups.filter(g => !g.isPublic) ?? [])

const displayGroups = computed(() => nonPublicGroups.value)
const hasDisplayGroups = computed(() => displayGroups.value.length > 0)

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    selectedGroupIds.value = []
    caption.value = ''

    if (props.prefillPhoto) {
      file.value = props.prefillPhoto
      preview.value = URL.createObjectURL(props.prefillPhoto)
    } else {
      file.value = null
      if (preview.value) URL.revokeObjectURL(preview.value)
      preview.value = null
    }

    loadingGroups.value = true
    try {
      groupsData.value = await api.getGroups()
    } catch {
      groupsData.value = { groups: [] }
    } finally {
      loadingGroups.value = false
    }
  }
})

const canSubmit = computed(() => !!file.value)

function triggerCameraCapture() {
  cameraInput.value?.click()
}

function triggerLibraryPicker() {
  libraryInput.value?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const selected = input.files?.[0]
  if (!selected) return

  file.value = selected
  preview.value = URL.createObjectURL(selected)
}

function clear() {
  file.value = null
  caption.value = ''
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = null
  if (cameraInput.value) cameraInput.value.value = ''
  if (libraryInput.value) libraryInput.value.value = ''
}

function close() {
  clear()
  emit('update:open', false)
}

function goToGroups() {
  showCreateGroupDialog.value = false
  close()
  router.push('/groups')
}

async function upload() {
  if (!file.value || !canSubmit.value) return

  if (props.momentMode && activeState.value?.capturedToday) {
    toast.add({
      title: 'Already captured today',
      description: 'You\'ve already posted your moment for today.',
      color: 'warning',
      icon: 'i-lucide-clock'
    })
    return
  }

  uploading.value = true
  try {
    compressing.value = true
    const photo = await compressImage(file.value)
    compressing.value = false

    const form = new FormData()
    form.append('photo', photo)
    if (caption.value.trim()) form.append('caption', caption.value.trim())
    form.append('groupIds', JSON.stringify(selectedGroupIds.value))

    if (props.momentMode) {
      form.append('isMoment', 'true')
      if (props.momentCapturedAt) {
        form.append('momentCapturedAt', props.momentCapturedAt)
      }
    }

    const post = await api.uploadPhoto(form)

    const title = props.momentMode ? 'Moment captured' : 'Photo uploaded'
    toast.add({ title, color: 'success', icon: 'i-lucide-circle-check' })
    emit('uploaded', post as unknown as PostData)
    close()
  } catch (e: unknown) {
    if (props.momentMode) {
      const err = e as { statusCode?: number, data?: { statusMessage?: string } }
      if (err.statusCode === 409) {
        toast.add({
          title: 'Missed the moment',
          description: err.data?.statusMessage || 'The moment window has closed.',
          color: 'warning',
          icon: 'i-lucide-clock'
        })
      } else if (err.statusCode === 403) {
        toast.add({
          title: 'Moment not available',
          description: err.data?.statusMessage || 'Moments are not enabled.',
          color: 'error',
          icon: 'i-lucide-triangle-alert'
        })
      } else {
        await saveOfflineDraft()
      }
    } else {
      toast.add({ title: 'Upload failed', description: 'Please try again.', color: 'error', icon: 'i-lucide-triangle-alert' })
    }
  } finally {
    compressing.value = false
    uploading.value = false
  }
}

async function saveOfflineDraft() {
  if (!file.value || !activeAccount.value) return

  const draft: MomentDraft = {
    id: crypto.randomUUID(),
    accountId: activeAccount.value.id,
    serverUrl: activeAccount.value.serverUrl,
    photo: file.value,
    capturedAt: props.momentCapturedAt || new Date().toISOString(),
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
}
</script>

<template>
  <UModal
    :open="props.open"
    :ui="{ content: 'flex flex-col h-full max-h-[100dvh] max-w-full m-0 rounded-none md:m-auto md:max-h-[85vh] md:rounded-xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="flex flex-col h-full">
        <div class="flex items-center justify-between px-6 py-4 pt-[calc(var(--safe-area-top,env(safe-area-inset-top))+1rem)] border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div class="flex items-center gap-2">
            <UIcon
              :name="momentMode ? 'i-lucide-aperture' : 'i-solar-upload-square-linear'"
              class="w-5 h-5 text-primary"
            />
            <span class="font-semibold">{{ momentMode ? 'Share moment' : 'Upload photo' }}</span>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            size="xs"
            @click="close"
          />
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div
            v-if="preview"
            class="relative rounded-xl border-2 border-solid overflow-hidden"
            :class="momentMode ? 'border-primary/50' : 'border-primary'"
          >
            <img
              :src="preview"
              alt="Preview"
              class="w-full h-auto max-h-80 object-cover"
            >
          </div>

          <div
            v-else
            class="grid grid-cols-2 gap-3"
          >
            <button
              class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 py-10 text-center transition-colors hover:border-primary hover:bg-primary/5"
              @click="triggerCameraCapture"
            >
              <UIcon
                name="i-lucide-camera"
                class="w-8 h-8 text-muted"
              />
              <div>
                <p class="font-medium text-sm">
                  Take Photo
                </p>
                <p class="text-muted text-xs mt-1">
                  Open camera
                </p>
              </div>
            </button>
            <button
              class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 py-10 text-center transition-colors hover:border-primary hover:bg-primary/5"
              @click="triggerLibraryPicker"
            >
              <UIcon
                name="i-lucide-image"
                class="w-8 h-8 text-muted"
              />
              <div>
                <p class="font-medium text-sm">
                  Choose from Library
                </p>
                <p class="text-muted text-xs mt-1">
                  JPEG, PNG, WebP, GIF
                </p>
              </div>
            </button>
          </div>

          <input
            ref="cameraInput"
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden"
            @change="onFileChange"
          >
          <input
            ref="libraryInput"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            class="hidden"
            @change="onFileChange"
          >

          <div
            v-if="preview"
            class="flex justify-end"
          >
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-refresh-cw"
              @click="triggerLibraryPicker"
            >
              Change photo
            </UButton>
          </div>

          <UTextarea
            v-model="caption"
            placeholder="Add a caption..."
            :rows="3"
            :maxlength="500"
            class="w-full"
          />
          <p class="text-xs text-muted text-right -mt-2">
            {{ caption.length }} / 500
          </p>
        </div>

        <div class="border-t border-neutral-200 dark:border-neutral-800 px-6 py-4 pb-[calc(var(--safe-area-bottom,env(safe-area-inset-bottom))+1rem)] space-y-4 shrink-0">
          <div
            v-if="hasDisplayGroups"
            class="space-y-2"
          >
            <p class="text-xs font-medium text-muted uppercase tracking-wider">
              {{ momentMode ? 'Share to' : 'Visible to' }}
            </p>
            <div class="space-y-1.5">
              <label
                v-for="group in displayGroups"
                :key="group.id"
                class="flex items-center gap-2.5 cursor-pointer group"
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
              {{ momentMode ? 'Share to groups for your moment.' : 'Visible only to members of selected groups. Uncheck all to post publicly.' }}
            </p>
          </div>

          <div
            v-else-if="!loadingGroups"
            class="rounded-lg bg-muted/30 p-3 space-y-2"
          >
            <div class="flex items-center gap-2">
              <UIcon
                :name="momentMode ? 'i-lucide-aperture' : 'i-solar-global-linear'"
                class="w-4 h-4 text-muted"
              />
              <p class="text-xs text-muted">
                {{ momentMode ? 'No groups available for moments' : 'Visible to everyone on this server' }}
              </p>
            </div>
            <p
              v-if="!momentMode"
              class="text-xs text-muted"
            >
              Want to share privately?
              <button
                class="text-primary hover:underline font-medium"
                @click.prevent="showCreateGroupDialog = true"
              >
                Create a group
              </button>
              to control who sees your photos.
            </p>
          </div>

          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="close"
            >
              Cancel
            </UButton>
            <UButton
              color="primary"
              variant="solid"
              :loading="uploading"
              :disabled="!canSubmit"
              :label="compressing ? 'Processing...' : (momentMode ? 'Post' : 'Upload')"
              :icon="momentMode ? 'i-lucide-aperture' : 'i-solar-upload-square-linear'"
              @click="upload"
            />
          </div>
        </div>
      </div>
    </template>
  </UModal>

  <UModal v-model:open="showCreateGroupDialog">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon
              name="i-solar-users-group-rounded-linear"
              class="w-5 h-5 text-primary"
            />
            <span class="font-semibold">Create a group?</span>
          </div>
        </template>

        <p class="text-sm text-muted">
          You'll be taken to the Groups page to create your group. Your current post draft will not be saved.
        </p>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="() => { showCreateGroupDialog = false }"
            >
              Stay here
            </UButton>
            <UButton
              color="primary"
              variant="solid"
              @click="goToGroups"
            >
              Go to Groups
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

<style scoped>
img {
  max-height: 320px;
  object-fit: cover;
}
</style>
