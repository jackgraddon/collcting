import imageCompression from 'browser-image-compression'

// The server stores uploads as-is with no transcoding, so clients convert to
// WebP on-device before uploading (longest edge ≤ 2048px, quality ~0.85).
// GIFs are passed through unmodified to preserve animation.
// Accepts Blob because moment drafts round-trip through IndexedDB as Blobs.
export async function compressImage(file: Blob): Promise<File> {
  const input = file instanceof File ? file : new File([file], 'photo', { type: file.type || 'image/jpeg' })

  if (input.type === 'image/gif') return input

  const compressed = await imageCompression(input, {
    maxSizeMB: 4,
    maxWidthOrHeight: 2048,
    fileType: 'image/webp',
    initialQuality: 0.85,
    useWebWorker: true
  })

  const name = input.name.replace(/\.[^.]+$/, '') + '.webp'
  return new File([compressed], name, {
    type: 'image/webp',
    lastModified: Date.now()
  })
}
