export function useShare() {
  const { isNative } = usePlatform()
  const toast = useToast()

  async function share(data: { title: string, text: string, url: string }) {
    if (isNative.value) {
      try {
        const { Share } = await import('@capacitor/share')
        await Share.share(data)
      } catch {
        await copyToClipboard(data.url)
      }
    } else {
      try {
        await navigator.share(data)
      } catch {
        await copyToClipboard(data.url)
      }
    }
  }

  async function copyToClipboard(text: string) {
    if (isNative.value) {
      const { Clipboard } = await import('@capacitor/clipboard')
      await Clipboard.write({ string: text })
    } else {
      await navigator.clipboard.writeText(text)
    }
    toast.add({ title: 'Link copied', color: 'neutral', icon: 'solar:link-linear' })
  }

  return { share, copyToClipboard }
}
