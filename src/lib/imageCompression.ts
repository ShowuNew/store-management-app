import imageCompression from 'browser-image-compression'

export const compressImage = async (file: File): Promise<File> => {
  if (file.size <= 500 * 1024) return file

  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg' as const,
    initialQuality: 0.8,
  }

  try {
    return await imageCompression(file, options)
  } catch {
    return file
  }
}
