import {useVirtualizer} from '@tanstack/react-virtual'
import {useGesture} from '@use-gesture/react'
import type {PDFDocumentProxy} from 'pdfjs-dist'
import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react'
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

const PdfPages = ({pageSizes}: {pageSizes: PageSize[]}) => {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const pendingScrollRef = useRef<PendingScroll | null>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [scale, setScale] = useState(1)
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
    setScale(fittedScale)
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

  useGesture(
    {
      onDrag: ({first, movement: [x, y], memo, pinching}) => {
        const scroller = scrollerRef.current
        if (!scroller || pinching) return memo
        const start = first ? [scroller.scrollLeft, scroller.scrollTop] : memo
        if (!Array.isArray(start)) return memo
        scroller.scrollLeft = start[0] - x
        scroller.scrollTop = start[1] - y
        return start
      },
      onPinch: ({offset: [nextScale], origin}) => zoomAt(nextScale, origin),
    },
    {
      target: scrollerRef,
      eventOptions: {passive: false},
      drag: {
        filterTaps: true,
        preventDefault: true,
        pointer: {buttons: 1},
      },
      pinch: {
        from: () => [scaleRef.current, 0],
        modifierKey: 'ctrlKey',
        pinchOnWheel: true,
        preventDefault: true,
        scaleBounds: () => ({
          min: (initialScale ?? 1) * MIN_ZOOM_FACTOR,
          max: (initialScale ?? 1) * MAX_ZOOM_FACTOR,
        }),
      },
    },
  )

  return (
    <div
      ref={scrollerRef}
      className={styles.scroller}
      aria-label='PDF viewer. Drag to pan, pinch or Control-scroll to zoom.'
      role='region'
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
            const renderedWidth = pageSize.width * scale
            const renderedHeight = pageSize.height * scale
            const devicePixelRatio = Math.min(
              window.devicePixelRatio,
              MAX_RENDER_DIMENSION / Math.max(renderedWidth, renderedHeight),
            )
            return (
              <div
                key={virtualPage.key}
                className={styles.pageRow}
                style={{
                  width: contentWidth,
                  height: renderedHeight,
                  transform: `translateY(${virtualPage.start}px)`,
                }}
              >
                <Page
                  className={styles.page}
                  pageNumber={virtualPage.index + 1}
                  width={renderedWidth}
                  devicePixelRatio={devicePixelRatio}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  suspense={false}
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
