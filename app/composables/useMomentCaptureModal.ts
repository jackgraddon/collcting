export function useMomentCaptureModal() {
  const open = useState('moment-capture-open', () => false)
  const capturedFile = useState<File | null>('moment-captured-file', () => null)
  const capturedAt = useState<string>('moment-captured-at', () => '')

  function openMomentModal() {
    open.value = true
  }

  function onCaptured(file: File, at: string) {
    capturedFile.value = file
    capturedAt.value = at
    open.value = false
  }

  function clearCapture() {
    capturedFile.value = null
    capturedAt.value = ''
  }

  return {
    open,
    capturedFile,
    capturedAt,
    openMomentModal,
    onCaptured,
    clearCapture
  }
}
