export function useUploadModal() {
  const open = useState('upload-modal-open', () => false)
  const momentMode = useState('upload-modal-moment', () => false)

  function openModal() {
    momentMode.value = false
    open.value = true
  }

  function openMomentModal() {
    momentMode.value = true
    open.value = true
  }

  function closeModal() {
    open.value = false
    momentMode.value = false
  }

  return {
    open,
    momentMode,
    openModal,
    openMomentModal,
    closeModal
  }
}
