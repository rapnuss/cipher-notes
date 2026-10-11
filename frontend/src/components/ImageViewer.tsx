import {ActionIcon} from '@mantine/core'
import React, {CSSProperties, useLayoutEffect, useRef, useState} from 'react'
import {TransformWrapper, TransformComponent, ReactZoomPanPinchRef} from 'react-zoom-pan-pinch'
import {IconPlus} from './icons/IconPlus'
import {IconMinus} from './icons/IconMinus'
import {IconZoomReset} from './icons/IconZoomReset'
import {FileScrollPosition} from '../business/models'
import {useCurrentCallback} from '../util/useCurrentCallback'

const VIEW_STATE_SAVE_DELAY_MS = 300

type ImageScrollPosition = Extract<FileScrollPosition, {type: 'image'}>

const getContainedImageRect = (
  viewportWidth: number,
  viewportHeight: number,
  imageWidth: number,
  imageHeight: number,
) => {
  const viewportRatio = viewportWidth / viewportHeight
  const imageRatio = imageWidth / imageHeight
  if (viewportRatio > imageRatio) {
    const height = viewportHeight
    const width = height * imageRatio
    return {left: (viewportWidth - width) / 2, top: 0, width, height}
  }
  const width = viewportWidth
  const height = width / imageRatio
  return {left: 0, top: (viewportHeight - height) / 2, width, height}
}

const getImageCenter = (
  position: {scale: number; positionX: number; positionY: number},
  viewport: {width: number; height: number},
  image: {width: number; height: number},
): ImageScrollPosition => {
  const imageRect = getContainedImageRect(
    viewport.width,
    viewport.height,
    image.width,
    image.height,
  )
  const contentCenterX = (viewport.width / 2 - position.positionX) / position.scale
  const contentCenterY = (viewport.height / 2 - position.positionY) / position.scale
  return {
    type: 'image',
    scale: position.scale,
    centerX: (contentCenterX - imageRect.left) / imageRect.width,
    centerY: (contentCenterY - imageRect.top) / imageRect.height,
  }
}

const getImageTransform = (
  position: ImageScrollPosition,
  viewport: {width: number; height: number},
  image: {width: number; height: number},
) => {
  const imageRect = getContainedImageRect(
    viewport.width,
    viewport.height,
    image.width,
    image.height,
  )
  const contentCenterX = imageRect.left + position.centerX * imageRect.width
  const contentCenterY = imageRect.top + position.centerY * imageRect.height
  return {
    positionX: viewport.width / 2 - contentCenterX * position.scale,
    positionY: viewport.height / 2 - contentCenterY * position.scale,
  }
}

type ImageViewerProps = {
  src: string
  alt?: string
  className?: string
  style?: CSSProperties
  showControls?: boolean
  initialScrollPosition?: FileScrollPosition | null
  onScrollPositionChange?: (position: FileScrollPosition) => void
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  src,
  alt = '',
  className,
  style,
  showControls = true,
  initialScrollPosition,
  onScrollPositionChange,
}) => {
  const [initialPosition] = useState<ImageScrollPosition | null>(() =>
    initialScrollPosition?.type === 'image' ? initialScrollPosition : null,
  )
  const viewportRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null)
  const viewportSizeRef = useRef({width: 0, height: 0})
  const restoredRef = useRef(false)
  const latestPositionRef = useRef<ImageScrollPosition | null>(initialPosition)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentOnScrollPositionChange = useCurrentCallback((position: FileScrollPosition) =>
    onScrollPositionChange?.(position),
  )

  const savePosition = useCurrentCallback(() => {
    const transform = transformRef.current?.state
    const image = imageRef.current
    const viewport = viewportSizeRef.current
    if (
      transform &&
      image?.naturalWidth &&
      viewport.width > 0 &&
      viewport.height > 0 &&
      (!initialPosition || restoredRef.current)
    ) {
      const position = getImageCenter(transform, viewport, {
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
      latestPositionRef.current = position
      currentOnScrollPositionChange(position)
    } else if (latestPositionRef.current) {
      currentOnScrollPositionChange(latestPositionRef.current)
    }
  })

  const restorePosition = useCurrentCallback((transform: ReactZoomPanPinchRef) => {
    if (!initialPosition || restoredRef.current) return
    const viewportElement = viewportRef.current
    const imageElement = imageRef.current
    if (!viewportElement || !imageElement?.naturalWidth) return

    const viewport = {width: viewportElement.clientWidth, height: viewportElement.clientHeight}
    if (viewport.width === 0 || viewport.height === 0) return
    viewportSizeRef.current = viewport
    const image = {width: imageElement.naturalWidth, height: imageElement.naturalHeight}
    const centerPosition: ImageScrollPosition = initialPosition
    const restoredTransform = getImageTransform(centerPosition, viewport, image)
    restoredRef.current = true
    latestPositionRef.current = centerPosition
    transform.setTransform(
      restoredTransform.positionX,
      restoredTransform.positionY,
      centerPosition.scale,
      0,
    )
  })

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return
      viewportSizeRef.current = {width: entry.contentRect.width, height: entry.contentRect.height}
    })
    resizeObserver.observe(viewport)
    window.addEventListener('pagehide', savePosition)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('pagehide', savePosition)
      if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current)
      savePosition()
    }
  }, [savePosition])

  return (
    <div
      ref={viewportRef}
      className={className}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        touchAction: 'none', // disable browser pinch-zoom
        ...style,
      }}
    >
      <TransformWrapper
        minScale={0.1}
        maxScale={10}
        initialScale={initialPosition?.scale}
        centerOnInit={!initialPosition}
        limitToBounds
        wheel={{step: 0.1}}
        pinch={{step: 5}}
        doubleClick={{disabled: true}}
        onInit={(transform) => {
          transformRef.current = transform
          restorePosition(transform)
        }}
        onTransform={(transform, position) => {
          transformRef.current = transform
          const image = imageRef.current
          const viewport = viewportSizeRef.current
          if (image?.naturalWidth && viewport.width > 0 && viewport.height > 0) {
            latestPositionRef.current = getImageCenter(position, viewport, {
              width: image.naturalWidth,
              height: image.naturalHeight,
            })
          }
          if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current)
          saveTimerRef.current = setTimeout(() => {
            saveTimerRef.current = null
            savePosition()
          }, VIEW_STATE_SAVE_DELAY_MS)
        }}
      >
        {({zoomIn, zoomOut, centerView}) => (
          <>
            {showControls && (
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  display: 'flex',
                  gap: 4,
                  zIndex: 10,
                }}
              >
                <ActionIcon onClick={() => zoomIn()} title='Zoom in' variant='default'>
                  <IconPlus />
                </ActionIcon>
                <ActionIcon onClick={() => zoomOut()} title='Zoom out' variant='default'>
                  <IconMinus />
                </ActionIcon>
                <ActionIcon onClick={() => centerView(1)} title='Reset zoom' variant='default'>
                  <IconZoomReset />
                </ActionIcon>
              </div>
            )}

            <TransformComponent
              wrapperStyle={{width: '100%', height: '100%'}}
              contentStyle={{width: '100%', height: '100%'}}
            >
              <img
                ref={imageRef}
                src={src}
                alt={alt}
                onLoad={() => {
                  if (transformRef.current) restorePosition(transformRef.current)
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  userSelect: 'none',
                  touchAction: 'none',
                }}
              />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  )
}
