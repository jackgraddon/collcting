const returningPhotoId = ref<number | null>(null)

const IS_SAFARI = import.meta.client
  ? /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  : false

export function supportsViewTransitions() {
  return import.meta.client
    && 'startViewTransition' in document
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function supportsViewTransitionMorph() {
  return supportsViewTransitions() && !IS_SAFARI
}

export function useViewTransition() {
  function setReturning(id: number) {
    returningPhotoId.value = id
  }

  function clearReturning() {
    returningPhotoId.value = null
  }

  return { returningPhotoId: readonly(returningPhotoId), setReturning, clearReturning }
}
