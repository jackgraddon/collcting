type UploadCallback = (post: PostData) => void

const listeners: UploadCallback[] = []

export function useUploadBus() {
  function emit(post: PostData) {
    for (const cb of listeners) {
      cb(post)
    }
  }

  function on(callback: UploadCallback) {
    listeners.push(callback)

    onUnmounted(() => {
      const idx = listeners.indexOf(callback)
      if (idx !== -1) listeners.splice(idx, 1)
    })
  }

  return { emit, on }
}
