import {useVirtualizer} from '@tanstack/react-virtual'
import type {PDFDocumentProxy} from 'pdfjs-dist'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {Document, Page, pdfjs} from 'react-pdf'
import styles from './PdfViewer.module.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const PAGE_GAP = 16
const HORIZONTAL_PADDING = 32
const MIN_ZOOM_FACTOR = 0.25
const MAX_ZOOM_FACTOR = 8
const MAX_RENDER_DIMENSION = 4096
const PAGE_METADATA_CONCURRENCY = 8
const WHEEL_RENDER_SETTLE_MS = 160

const documentOptions = {
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  wasmUrl: '/pdfjs/wasm/',
  isEvalSupported: false,
}

type PageSize = {
  width: number
  height: number
}

type PendingScroll = {
  left: number
  top: number
}

type PointerPosition = {
  x: number
  y: number
}

type PanGesture = PointerPosition &
  PendingScroll & {
    pointerId: number
  }

type PinchGesture = {
  distance: number
  scale: number
}

type PdfViewerProps = {
  file: Blob
  title?: string
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const getPageStart = (pageOffsets: number[], pageIndex: number, scale: number) =>
  (pageOffsets[pageIndex] ?? 0) * scale + pageIndex * PAGE_GAP

const getVerticalAnchor = (
  pageSizes: PageSize[],
  pageOffsets: number[],
  offset: number,
  scale: number,
) => {
  let low = 0
  let high = pageSizes.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (getPageStart(pageOffsets, middle, scale) <= offset) low = middle
    else high = middle - 1
  }

  const pageSize = pageSizes[low]
  if (!pageSize) return {index: 0, ratio: 0}
  const start = getPageStart(pageOffsets, low, scale)
  const itemSize = pageSize.height * scale + PAGE_GAP
  return {index: low, ratio: clamp((offset - start) / itemSize, 0, 1)}
}

const getPageSizes = async (pdf: PDFDocumentProxy) => {
  const pageSizes: PageSize[] = new Array(pdf.numPages)

  for (let start = 0; start < pdf.numPages; start += PAGE_METADATA_CONCURRENCY) {
    const end = Math.min(start + PAGE_METADATA_CONCURRENCY, pdf.numPages)
    await Promise.all(
      Array.from({length: end - start}, async (_, offset) => {
        const pageIndex = start + offset
        const page = await pdf.getPage(pageIndex + 1)
        const viewport = page.getViewport({scale: 1})
        pageSizes[pageIndex] = {width: viewport.width, height: viewport.height}
      }),
    )
  }

  return pageSizes
}

type BufferedPdfPageProps = {
  pageNumber: number
  pageSize: PageSize
  renderScale: number
  viewScale: number
}

const BufferedPdfPage = ({
  pageNumber,
  pageSize,
  renderScale,
  viewScale,
}: BufferedPdfPageProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bufferRef = useRef<HTMLCanvasElement>(null)
  const previousRenderScaleRef = useRef(renderScale)
  const renderedWidth = pageSize.width * renderScale
  const renderedHeight = pageSize.height * renderScale
  const viewWidth = pageSize.width * viewScale
  const viewHeight = pageSize.height * viewScale
  const previewScale = viewScale / renderScale
  const devicePixelRatio = Math.min(
    window.devicePixelRatio,
    MAX_RENDER_DIMENSION / Math.max(renderedWidth, renderedHeight),
  )

  useLayoutEffect(() => {
    if (previousRenderScaleRef.current === renderScale) return
    previousRenderScaleRef.current = renderScale

    const source = canvasRef.current
    const buffer = bufferRef.current
    if (!source || !buffer || source.width === 0 || source.height === 0) return
    if (source.style.visibility === 'hidden') return

    buffer.width = source.width
    buffer.height = source.height
    const context = buffer.getContext('2d', {alpha: false})
    if (!context) return
    context.drawImage(source, 0, 0)
    buffer.style.visibility = 'visible'
  }, [renderScale])

  const onRenderSuccess = useCallback(() => {
    const buffer = bufferRef.current
    if (!buffer) return
    buffer.style.visibility = 'hidden'
    buffer.width = 0
    buffer.height = 0
  }, [])

  return (
    <div className={styles.page} style={{width: viewWidth, height: viewHeight}}>
      <div
        className={styles.pageRender}
        style={{
          width: renderedWidth,
          height: renderedHeight,
          transform: `scale(${previewScale})`,
        }}
      >
        <Page
          canvasRef={canvasRef}
          pageNumber={pageNumber}
          width={renderedWidth}
          devicePixelRatio={devicePixelRatio}
          onRenderSuccess={onRenderSuccess}
          renderAnnotationLayer={false}
          renderTextLayer={false}
          suspense={false}
        />
      </div>
      <canvas ref={bufferRef} className={styles.renderBuffer} />
    </div>
  )
}

const PdfPages = ({pageSizes}: {pageSizes: PageSize[]}) => {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const renderScaleRef = useRef(1)
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingScrollRef = useRef<PendingScroll | null>(null)
  const pointersRef = useRef(new Map<number, PointerPosition>())
  const panGestureRef = useRef<PanGesture | null>(null)
  const pinchGestureRef = useRef<PinchGesture | null>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [scale, setScale] = useState(1)
  const [renderScale, setRenderScale] = useState(1)
  const [initialScale, setInitialScale] = useState<number | null>(null)

  const widestPage = pageSizes.reduce((widest, page) => Math.max(widest, page.width), 0)
  const pageOffsets = useMemo(() => {
    let offset = 0
    return pageSizes.map((page) => {
      const currentOffset = offset
      offset += page.height
      return currentOffset
    })
  }, [pageSizes])
  const contentWidth = Math.max(viewportWidth, widestPage * scale + HORIZONTAL_PADDING)

  // TanStack Virtual intentionally returns mutable imperative functions.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: pageSizes.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: (index) => (pageSizes[index]?.height ?? 0) * scale + PAGE_GAP,
    overscan: 1,
  })

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) setViewportWidth(entry.contentRect.width)
    })
    resizeObserver.observe(scroller)
    setViewportWidth(scroller.clientWidth)

    return () => resizeObserver.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (initialScale !== null || viewportWidth === 0 || widestPage === 0) return
    const fittedScale = Math.max(1, viewportWidth - HORIZONTAL_PADDING) / widestPage
    scaleRef.current = fittedScale
    renderScaleRef.current = fittedScale
    setScale(fittedScale)
    setRenderScale(fittedScale)
    setInitialScale(fittedScale)
  }, [initialScale, viewportWidth, widestPage])

  useLayoutEffect(() => {
    virtualizer.measure()
    const pendingScroll = pendingScrollRef.current
    const scroller = scrollerRef.current
    if (!pendingScroll || !scroller) return
    pendingScrollRef.current = null
    scroller.scrollLeft = pendingScroll.left
    scroller.scrollTop = pendingScroll.top
  }, [scale, virtualizer])

  const zoomAt = useCallback(
    (requestedScale: number, origin: [number, number]) => {
      const scroller = scrollerRef.current
      if (!scroller || initialScale === null) return

      const oldScale = scaleRef.current
      const nextScale = clamp(
        requestedScale,
        initialScale * MIN_ZOOM_FACTOR,
        initialScale * MAX_ZOOM_FACTOR,
      )
      if (Math.abs(nextScale - oldScale) < 0.0001) return

      const bounds = scroller.getBoundingClientRect()
      const localX = origin[0] - bounds.left
      const localY = origin[1] - bounds.top
      const currentScroll = pendingScrollRef.current ?? {
        left: scroller.scrollLeft,
        top: scroller.scrollTop,
      }
      const oldContentWidth = Math.max(
        scroller.clientWidth,
        widestPage * oldScale + HORIZONTAL_PADDING,
      )
      const nextContentWidth = Math.max(
        scroller.clientWidth,
        widestPage * nextScale + HORIZONTAL_PADDING,
      )
      const horizontalDistanceFromCenter = currentScroll.left + localX - oldContentWidth / 2
      const verticalAnchor = getVerticalAnchor(
        pageSizes,
        pageOffsets,
        currentScroll.top + localY,
        oldScale,
      )
      const anchorPage = pageSizes[verticalAnchor.index]
      if (!anchorPage) return
      const nextPageStart = getPageStart(pageOffsets, verticalAnchor.index, nextScale)
      const nextItemHeight = anchorPage.height * nextScale + PAGE_GAP

      pendingScrollRef.current = {
        left:
          nextContentWidth / 2 +
          horizontalDistanceFromCenter * (nextScale / oldScale) -
          localX,
        top: nextPageStart + verticalAnchor.ratio * nextItemHeight - localY,
      }
      scaleRef.current = nextScale
      setScale(nextScale)
    },
    [initialScale, pageOffsets, pageSizes, widestPage],
  )

  const clearRenderTimer = useCallback(() => {
    if (renderTimerRef.current === null) return
    clearTimeout(renderTimerRef.current)
    renderTimerRef.current = null
  }, [])

  const commitRenderScale = useCallback(() => {
    clearRenderTimer()
    const nextRenderScale = scaleRef.current
    if (Math.abs(nextRenderScale - renderScaleRef.current) < 0.0001) return
    renderScaleRef.current = nextRenderScale
    setRenderScale(nextRenderScale)
  }, [clearRenderTimer])

  const scheduleRenderScale = useCallback(() => {
    clearRenderTimer()
    renderTimerRef.current = setTimeout(commitRenderScale, WHEEL_RENDER_SETTLE_MS)
  }, [clearRenderTimer, commitRenderScale])

  useEffect(() => clearRenderTimer, [clearRenderTimer])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      const pixels =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? event.deltaY * scroller.clientHeight
        : event.deltaY
      zoomAt(scaleRef.current * Math.exp(-pixels * 0.002), [event.clientX, event.clientY])
      scheduleRenderScale()
    }

    scroller.addEventListener('wheel', onWheel, {passive: false})
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [scheduleRenderScale, zoomAt])

  const getCurrentScroll = useCallback(() => {
    const scroller = scrollerRef.current
    return (
      pendingScrollRef.current ?? {
        left: scroller?.scrollLeft ?? 0,
        top: scroller?.scrollTop ?? 0,
      }
    )
  }, [])

  const startPinch = useCallback(() => {
    clearRenderTimer()
    const points = [...pointersRef.current.values()]
    const first = points[0]
    const second = points[1]
    if (!first || !second) return
    pinchGestureRef.current = {
      distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
      scale: scaleRef.current,
    }
    panGestureRef.current = null
  }, [clearRenderTimer])

  const startPan = useCallback(
    (pointerId: number, point: PointerPosition) => {
      const scroll = getCurrentScroll()
      panGestureRef.current = {...point, ...scroll, pointerId}
      pinchGestureRef.current = null
    },
    [getCurrentScroll],
  )

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      const point = {x: event.clientX, y: event.clientY}
      pointersRef.current.set(event.pointerId, point)

      if (pointersRef.current.size === 1) startPan(event.pointerId, point)
      else startPinch()
    },
    [startPan, startPinch],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pointers = pointersRef.current
      if (!pointers.has(event.pointerId)) return
      event.preventDefault()
      pointers.set(event.pointerId, {x: event.clientX, y: event.clientY})

      if (pointers.size >= 2) {
        if (!pinchGestureRef.current) startPinch()
        const pinch = pinchGestureRef.current
        const points = [...pointers.values()]
        const first = points[0]
        const second = points[1]
        if (!pinch || !first || !second) return
        const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y))
        zoomAt(pinch.scale * (distance / pinch.distance), [
          (first.x + second.x) / 2,
          (first.y + second.y) / 2,
        ])
        return
      }

      const pan = panGestureRef.current
      const scroller = scrollerRef.current
      if (!pan || !scroller || pan.pointerId !== event.pointerId) return
      const nextScroll = {
        left: pan.left - (event.clientX - pan.x),
        top: pan.top - (event.clientY - pan.y),
      }
      scroller.scrollLeft = nextScroll.left
      scroller.scrollTop = nextScroll.top
      if (pendingScrollRef.current) pendingScrollRef.current = nextScroll
    },
    [startPinch, zoomAt],
  )

  const onPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pointers = pointersRef.current
      const wasPinching = pointers.size >= 2
      if (!pointers.delete(event.pointerId)) return

      if (pointers.size >= 2) {
        startPinch()
        return
      }

      const remaining = pointers.entries().next().value as
        | [number, PointerPosition]
        | undefined
      if (wasPinching) commitRenderScale()
      if (remaining) startPan(remaining[0], remaining[1])
      else {
        panGestureRef.current = null
        pinchGestureRef.current = null
      }
    },
    [commitRenderScale, startPan, startPinch],
  )

  return (
    <div
      ref={scrollerRef}
      className={styles.scroller}
      aria-label='PDF viewer. Drag to pan, pinch or Control-scroll to zoom.'
      role='region'
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
    >
      {initialScale === null ?
        <div className={styles.message}>Preparing PDF…</div>
      : <div
          className={styles.pages}
          style={{width: contentWidth, height: virtualizer.getTotalSize()}}
        >
          {virtualizer.getVirtualItems().map((virtualPage) => {
            const pageSize = pageSizes[virtualPage.index]
            if (!pageSize) return null
            const viewHeight = pageSize.height * scale
            return (
              <div
                key={virtualPage.key}
                className={styles.pageRow}
                style={{
                  width: contentWidth,
                  height: viewHeight,
                  transform: `translateY(${virtualPage.start}px)`,
                }}
              >
                <BufferedPdfPage
                  pageNumber={virtualPage.index + 1}
                  pageSize={pageSize}
                  renderScale={renderScale}
                  viewScale={scale}
                />
              </div>
            )
          })}
        </div>}
    </div>
  )
}

export const PdfViewer = ({file, title = 'PDF document'}: PdfViewerProps) => {
  const loadGeneration = useRef(0)
  const [metadata, setMetadata] = useState<{
    file: Blob
    pageSizes: PageSize[]
    error: string | null
  }>({file, pageSizes: [], error: null})
  const pageSizes = metadata.file === file ? metadata.pageSizes : []
  const metadataError = metadata.file === file ? metadata.error : null

  const onLoadSuccess = useCallback(
    async (pdf: PDFDocumentProxy) => {
      const generation = ++loadGeneration.current
      try {
        const sizes = await getPageSizes(pdf)
        if (loadGeneration.current === generation) {
          setMetadata({file, pageSizes: sizes, error: null})
        }
      } catch (error) {
        if (loadGeneration.current !== generation) return
        setMetadata({
          file,
          pageSizes: [],
          error: error instanceof Error ? error.message : 'Could not inspect PDF pages.',
        })
      }
    },
    [file],
  )

  return (
    <div className={styles.root} aria-label={title}>
      <Document
        className={styles.document}
        file={file}
        options={documentOptions}
        onLoadSuccess={onLoadSuccess}
        loading={<div className={styles.message}>Loading PDF…</div>}
        error={<div className={styles.message}>Could not load PDF.</div>}
        noData={<div className={styles.message}>No PDF selected.</div>}
        suspense={false}
      >
        {metadataError ?
          <div className={styles.message}>{metadataError}</div>
        : pageSizes.length > 0 ?
          <PdfPages pageSizes={pageSizes} />
        : <div className={styles.message}>Preparing PDF…</div>}
      </Document>
    </div>
  )
}
