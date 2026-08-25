export function useUploadModal() {
  const open = useState('upload-modal-open', () => false)

  function openModal() {
    open.value = true
  }

  function closeModal() {
    open.value = false
  }

  return {
    open,
    openModal,
    closeModal
  }
}
