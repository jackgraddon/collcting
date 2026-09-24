const handlers = new WeakMap<HTMLElement, (e: Event) => void>()

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('click-outside', {
    mounted(el: HTMLElement, binding) {
      const handler = (e: Event) => {
        if (!el.contains(e.target as Node) && typeof binding.value === 'function') {
          binding.value(e)
        }
      }
      handlers.set(el, handler)
      document.addEventListener('click', handler)
    },
    unmounted(el: HTMLElement) {
      const handler = handlers.get(el)
      if (handler) {
        document.removeEventListener('click', handler)
        handlers.delete(el)
      }
    }
  })
})
