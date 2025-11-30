export const convertImageToPng = async (blob: Blob, mime: string): Promise<Blob> => {
  if (!mime.startsWith('image/')) {
    throw new Error('unsupported file type')
  }
  const img = document.createElement('img')
  const url = URL.createObjectURL(blob)
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = url
  }).finally(() => URL.revokeObjectURL(url))
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not available')
  ctx.drawImage(img, 0, 0)
  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('PNG conversion failed'))
    }, 'image/png')
  })
  return pngBlob
}
