import imageCompression from 'browser-image-compression'

export async function compressImage(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 4,
    maxWidthOrHeight: 2048,
    fileType: 'image/webp',
    useWebWorker: true
  })

  return new File([compressed], file.name, {
    type: compressed.type || file.type,
    lastModified: Date.now()
  })
}
