import {Text} from '@mantine/core'
import {useEffect, useState} from 'react'
import {monospaceStyle} from '../business/misc'

export type TextViewerProps = {src: string}
export const TextViewer = ({src}: TextViewerProps) => {
  const [text, setText] = useState<{src: string; text: string; error?: string} | null>(null)
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
  return (
    <Text
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
      {text?.error ?? text?.text ?? 'Loading...'}
    </Text>
  )
}
