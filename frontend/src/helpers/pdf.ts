import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export const pdfMimeType = 'application/pdf'

export const pdfDocumentOptions = {
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  iccUrl: '/pdfjs/iccs/',
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  wasmUrl: '/pdfjs/wasm/',
  isEvalSupported: false,
}

type OffscreenCanvasAndContext = {
  canvas: OffscreenCanvas | null
  context: OffscreenCanvasRenderingContext2D | null
}

class OffscreenCanvasFactory {
  create(width: number, height: number): OffscreenCanvasAndContext {
    if (width <= 0 || height <= 0) throw new Error('Invalid canvas size')

    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d', {willReadFrequently: true})
    if (!context) throw new Error('Failed to get canvas context')
    return {canvas, context}
  }

  reset(target: OffscreenCanvasAndContext, width: number, height: number): void {
    if (!target.canvas) throw new Error('Canvas is not specified')
    if (width <= 0 || height <= 0) throw new Error('Invalid canvas size')
    target.canvas.width = width
    target.canvas.height = height
  }

  destroy(target: OffscreenCanvasAndContext): void {
    if (!target.canvas) throw new Error('Canvas is not specified')
    target.canvas.width = 0
    target.canvas.height = 0
    target.canvas = null
    target.context = null
  }
}

// PDF.js's Node filter factory has the same no-op behavior. SVG-backed filters
// require a DOM and aren't available in a Web Worker.
class WorkerFilterFactory {
  addFilter(): string {
    return 'none'
  }
  addHCMFilter(): string {
    return 'none'
  }
  addAlphaFilter(): string {
    return 'none'
  }
  addLuminosityFilter(): string {
    return 'none'
  }
  addKnockoutFilter(): string {
    return 'none'
  }
  addHighlightHCMFilter(): string {
    return 'none'
  }
  addSelectionHCMFilter(): string {
    return 'none'
  }
  addSelectionFilter(): string {
    return 'none'
  }
  createSelectionStyle(): null {
    return null
  }
  destroy(): void {
    return undefined
  }
}

export const generatePdfThumbnail = async (
  pdfBlob: Blob,
  maxWidth = 400,
  maxHeight = 300,
): Promise<Blob> => {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
    throw new RangeError('maxWidth must be a positive finite number')
  }
  if (!Number.isFinite(maxHeight) || maxHeight <= 0) {
    throw new RangeError('maxHeight must be a positive finite number')
  }

  // PDF.js normally delegates parsing to another worker and uses `window` while
  // creating it. This function also runs inside our Comlink worker, where nested
  // PDF.js work is instead handled locally by the worker message handler.
  const isWorkerContext = typeof document === 'undefined'
  if (isWorkerContext) {
    await import('pdfjs-dist/build/pdf.worker.mjs')
  }

  const loadingTask = pdfjs.getDocument({
    ...pdfDocumentOptions,
    data: new Uint8Array(await pdfBlob.arrayBuffer()),
    ...(isWorkerContext && {
      CanvasFactory: OffscreenCanvasFactory,
      FilterFactory: WorkerFilterFactory,
      disableFontFace: true,
      useSystemFonts: false,
      useWorkerFetch: true,
    }),
  })

  try {
    const pdf = await loadingTask.promise
    const page = await pdf.getPage(1)
    const unscaledViewport = page.getViewport({scale: 1})
    const scale = Math.min(maxWidth / unscaledViewport.width, maxHeight / unscaledViewport.height)
    const viewport = page.getViewport({scale})
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(viewport.width)),
      Math.max(1, Math.round(viewport.height)),
    )
    const context = canvas.getContext('2d', {alpha: false})
    if (!context) throw new Error('Failed to get canvas context')

    await page.render({
      canvas: null,
      // PDF.js supports OffscreenCanvas at runtime, but its public type currently
      // only declares the equivalent DOM canvas context.
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
      background: '#fff',
    }).promise

    return await canvas.convertToBlob({type: 'image/jpeg', quality: 0.75})
  } finally {
    await loadingTask.destroy()
  }
}
