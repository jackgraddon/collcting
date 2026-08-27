export function useUploadModal() {
  const open = useState('upload-modal-open', () => false)
  const momentMode = useState('upload-modal-moment', () => false)
  const prefillPhoto = useState<File | null>('upload-modal-prefill', () => null)
  const momentCapturedAt = useState('upload-modal-captured-at', () => '')

  function openModal() {
    momentMode.value = false
    prefillPhoto.value = null
    momentCapturedAt.value = ''
    open.value = true
  }

  function openMomentModal(photo: File, capturedAt: string) {
    momentMode.value = true
    prefillPhoto.value = photo
    momentCapturedAt.value = capturedAt
    open.value = true
  }

  function closeModal() {
    open.value = false
    momentMode.value = false
    prefillPhoto.value = null
    momentCapturedAt.value = ''
  }

  return {
    open,
    momentMode,
    prefillPhoto,
    momentCapturedAt,
    openModal,
    openMomentModal,
    closeModal
  }
}
