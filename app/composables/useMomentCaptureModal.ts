export function useMomentCaptureModal() {
  const open = useState('moment-capture-open', () => false)

  function openMomentModal() {
    open.value = true
  }

  function closeModal() {
    open.value = false
  }

  return {
    open,
    openMomentModal,
    closeModal
  }
}
