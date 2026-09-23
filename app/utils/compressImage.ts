// Client-side image compression per spec: the server stores uploads
// byte-for-byte, so clients convert to WebP on-device before uploading.
// GIFs pass through untouched (decoding kills animation). Conversion must
// never block an upload — any failure falls back to the original file
// (notably HEIC from iPhones, which browsers can't decode).

interface CompressOptions {
  maxDimension?: number
  quality?: number
  filename?: string
}

const PHOTO_DEFAULTS = { maxDimension: 2048, quality: 0.85 } as const
const AVATAR_DEFAULTS = { maxDimension: 512, quality: 0.85 } as const

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

function toFile(blob: Blob, fallbackName: string): File {
  if (blob instanceof File) return blob
  return new File([blob], fallbackName, { type: blob.type || 'image/jpeg', lastModified: Date.now() })
}

export async function compressImage(file: Blob, opts: CompressOptions = {}): Promise<File> {
  const { maxDimension = PHOTO_DEFAULTS.maxDimension, quality = PHOTO_DEFAULTS.quality, filename } = opts
  const input = toFile(file, 'photo')

  // Skip GIFs entirely — canvas keeps only the first frame.
  if (input.type === 'image/gif') return input

  try {
    const bitmap = await createImageBitmap(input)
    try {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return input
      ctx.drawImage(bitmap, 0, 0, width, height)

      const output = await canvasToBlob(canvas, 'image/webp', quality)
      const base = (filename ?? input.name).replace(/\.[^.]+$/, '')
      if (output?.type === 'image/webp') {
        return new File([output], `${base}.webp`, { type: 'image/webp', lastModified: Date.now() })
      }

      // No WebP encoder (older Safari silently returns PNG instead) — fall
      // back to JPEG at the same scaled size so oversized originals (e.g.
      // 2MB+ phone photos for the 2MB avatar limit) still get small enough.
      const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality)
      if (jpeg?.type === 'image/jpeg') {
        return new File([jpeg], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
      }
      return input
    } finally {
      bitmap.close()
    }
  } catch {
    return input
  }
}

export async function compressAvatar(file: Blob): Promise<File> {
  return compressImage(file, { ...AVATAR_DEFAULTS, filename: 'avatar.webp' })
}
