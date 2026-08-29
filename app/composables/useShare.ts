import { Share } from '@capacitor/share'
import { Clipboard } from '@capacitor/clipboard'

export function useShare() {
  const { isNative } = usePlatform()
  const toast = useToast()

  async function share(data: { title: string, text: string, url: string }) {
    if (isNative.value) {
      try {
        await Share.share(data)
      } catch {
        // User cancelled or share failed — fall back to clipboard
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
      await Clipboard.write({ string: text })
    } else {
      await navigator.clipboard.writeText(text)
    }
    toast.add({ title: 'Link copied', color: 'neutral', icon: 'solar:link-linear' })
  }

  return { share, copyToClipboard }
}
