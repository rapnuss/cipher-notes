import {Text} from '@mantine/core'
import {useEffect, useLayoutEffect, useRef, useState} from 'react'
import {monospaceStyle} from '../business/misc'
import {TextScrollPosition} from '../business/models'
import {observeChildIndex} from '../util/observeScrollPosition'
import {useCurrentCallback} from '../util/useCurrentCallback'

export type TextViewerProps = {
  src: string
  initialScrollPosition: TextScrollPosition | null
  onScrollPositionChange: (position: TextScrollPosition) => void
}
export const TextViewer = ({
  src,
  initialScrollPosition,
  onScrollPositionChange,
}: TextViewerProps) => {
  const [text, setText] = useState<{src: string; text: string; error?: string} | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const initialPositionRef = useRef(
    initialScrollPosition?.type === 'text' ? initialScrollPosition : null,
  )
  const currentOnScrollPositionChange = useCurrentCallback(onScrollPositionChange)
  useEffect(() => {
    const abortController = new AbortController()
    const fetchSrc = src
    // eslint-disable-next-line -- resetting to loading state when src changes is intentional
    setText(null)
    fetch(fetchSrc, {signal: abortController.signal})
      .then((res) => res.text())
      .then((text) => {
        if (fetchSrc === src) setText({src: fetchSrc, text})
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setText({src: fetchSrc, text: '', error: err.message})
      })
    return () => abortController.abort()
  }, [src])
  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element || text?.src !== src) return
    const initialPosition = initialPositionRef.current
    const initialTop = initialPosition?.row_index ?? 0
    return observeChildIndex(element, initialTop, (rowIndex) => {
      currentOnScrollPositionChange({type: 'text', row_index: rowIndex})
    })
  }, [currentOnScrollPositionChange, src, text?.src])
  return (
    <Text
      component='div'
      ref={scrollRef}
      style={{
        color: text?.error ? 'red' : 'inherit',
        flex: '1 1 0',
        ...monospaceStyle,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        overflowX: 'hidden',
        overflowY: 'auto',
        tabSize: 2,
      }}
    >
      {(text?.error ?? text?.text ?? 'Loading...').split(/[\r\n]+/).map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </Text>
  )
}
