import {ActionIcon} from '@mantine/core'
import React, {CSSProperties} from 'react'
import {TransformWrapper, TransformComponent} from 'react-zoom-pan-pinch'
import {IconPlus} from './icons/IconPlus'
import {IconMinus} from './icons/IconMinus'
import {IconZoomReset} from './icons/IconZoomReset'

type ImageViewerProps = {
  src: string
  alt?: string
  className?: string
  style?: CSSProperties
  showControls?: boolean
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  src,
  alt = '',
  className,
  style,
  showControls = true,
}) => (
  <div
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
      centerOnInit
      limitToBounds
      wheel={{step: 0.1}}
      pinch={{step: 5}}
      doubleClick={{disabled: true}}
    >
      {({zoomIn, zoomOut, resetTransform}) => (
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
              <ActionIcon onClick={() => resetTransform()} title='Reset zoom' variant='default'>
                <IconZoomReset />
              </ActionIcon>
            </div>
          )}

          <TransformComponent
            wrapperStyle={{width: '100%', height: '100%'}}
            contentStyle={{width: '100%', height: '100%'}}
          >
            <img
              src={src}
              alt={alt}
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
