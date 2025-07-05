export async function generateThumbnail(
  imageBlob: Blob,
  maxWidth = 200,
  maxHeight = 150
): Promise<Blob> {
  const imageBitmap = await createImageBitmap(imageBlob)
  const {width, height} = scaleDimensions(
    imageBitmap.width,
    imageBitmap.height,
    maxWidth,
    maxHeight
  )

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')

  ctx.drawImage(imageBitmap, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas failed to produce blob'))
      },
      'image/jpeg',
      0.75
    )
  })
}

function scaleDimensions(
  origWidth: number,
  origHeight: number,
  maxWidth: number,
  maxHeight: number
) {
  const ratio = Math.min(maxWidth / origWidth, maxHeight / origHeight)
  return {
    width: Math.round(origWidth * ratio),
    height: Math.round(origHeight * ratio),
  }
}

export const canvasSupportedImageMimeTypes = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/avif',
])
