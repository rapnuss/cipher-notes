import {
  ChangeEvent,
  CSSProperties,
  FocusEventHandler,
  forwardRef,
  HTMLAttributes,
  KeyboardEvent,
  KeyboardEventHandler,
  MouseEventHandler,
  Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

type Padding<T> = T | {top?: T; right?: T; bottom?: T; left?: T}

type Props = HTMLAttributes<HTMLDivElement> & {
  // Props for the component
  ignoreTabKey?: boolean
  insertSpaces?: boolean
  onValueChange: (value: string) => void
  padding?: Padding<number | string>
  style?: CSSProperties
  tabSize?: number
  value: string

  // Props for the textarea
  autoFocus?: boolean
  disabled?: boolean
  form?: string
  maxLength?: number
  minLength?: number
  name?: string
  onBlur?: FocusEventHandler<HTMLTextAreaElement>
  onClick?: MouseEventHandler<HTMLTextAreaElement>
  onFocus?: FocusEventHandler<HTMLTextAreaElement>
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>
  onKeyUp?: KeyboardEventHandler<HTMLTextAreaElement>
  placeholder?: string
  readOnly?: boolean
  required?: boolean
  textareaClassName?: string
  textareaId?: string
}

type Record = {
  value: string
  selectionStart: number
  selectionEnd: number
}

type History = {
  stack: (Record & {timestamp: number})[]
  offset: number
}

const HISTORY_LIMIT = 100
const HISTORY_TIME_GAP = 3000

const isWindows =
  typeof window !== 'undefined' && 'navigator' in window && /Win/i.test(navigator.platform)
const isMacLike =
  typeof window !== 'undefined' &&
  'navigator' in window &&
  /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)

const className = 'npm__react-simple-code-editor__textarea'

const Editor = forwardRef(function Editor(
  props: Props,
  ref: Ref<null | {session: {history: History}}>
) {
  const {
    autoFocus,
    disabled,
    form,
    ignoreTabKey = false,
    insertSpaces = true,
    maxLength,
    minLength,
    name,
    onBlur,
    onClick,
    onFocus,
    onKeyDown,
    onKeyUp,
    onValueChange,
    padding = 0,
    placeholder,
    readOnly,
    required,
    style,
    tabSize = 2,
    textareaClassName,
    textareaId,
    value,
    ...rest
  } = props

  const historyRef = useRef<History>({
    stack: [],
    offset: -1,
  })
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const [capture, setCapture] = useState(true)
  const contentStyle = {
    paddingTop: typeof padding === 'object' ? padding.top : padding,
    paddingRight: typeof padding === 'object' ? padding.right : padding,
    paddingBottom: typeof padding === 'object' ? padding.bottom : padding,
    paddingLeft: typeof padding === 'object' ? padding.left : padding,
  }

  const getLines = (text: string, position: number) => text.substring(0, position).split('\n')

  const recordChange = useCallback((record: Record, overwrite: boolean = false) => {
    const {stack, offset} = historyRef.current

    if (stack.length && offset > -1) {
      // When something updates, drop the redo operations
      historyRef.current.stack = stack.slice(0, offset + 1)

      // Limit the number of operations to 100
      const count = historyRef.current.stack.length

      if (count > HISTORY_LIMIT) {
        const extras = count - HISTORY_LIMIT

        historyRef.current.stack = stack.slice(extras, count)
        historyRef.current.offset = Math.max(historyRef.current.offset - extras, 0)
      }
    }

    const timestamp = Date.now()

    if (overwrite) {
      const last = historyRef.current.stack[historyRef.current.offset]

      if (last && timestamp - last.timestamp < HISTORY_TIME_GAP) {
        // A previous entry exists and was in short interval

        // Match the last word in the line
        const re = /[^a-z0-9]([a-z0-9]+)$/i

        // Get the previous line
        const previous = getLines(last.value, last.selectionStart).pop()?.match(re)

        // Get the current line
        const current = getLines(record.value, record.selectionStart).pop()?.match(re)

        if (previous?.[1] && current?.[1]?.startsWith(previous[1])) {
          // The last word of the previous line and current line match
          // Overwrite previous entry so that undo will remove whole word
          historyRef.current.stack[historyRef.current.offset] = {
            ...record,
            timestamp,
          }

          return
        }
      }
    }

    // Add the new operation to the stack
    historyRef.current.stack.push({...record, timestamp})
    historyRef.current.offset++
  }, [])

  const recordCurrentState = useCallback(() => {
    const input = inputRef.current

    if (!input) return

    // Save current state of the input
    const {value, selectionStart, selectionEnd} = input

    recordChange({
      value,
      selectionStart,
      selectionEnd,
    })
  }, [recordChange])

  const updateInput = (record: Record) => {
    const input = inputRef.current

    if (!input) return

    // Update values and selection state
    input.value = record.value
    input.selectionStart = record.selectionStart
    input.selectionEnd = record.selectionEnd

    onValueChange?.(record.value)
  }

  const applyEdits = (record: Record) => {
    // Save last selection state
    const input = inputRef.current
    const last = historyRef.current.stack[historyRef.current.offset]

    if (last && input) {
      historyRef.current.stack[historyRef.current.offset] = {
        ...last,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
      }
    }

    // Save the changes
    recordChange(record)
    updateInput(record)
  }

  const undoEdit = () => {
    const {stack, offset} = historyRef.current

    // Get the previous edit
    const record = stack[offset - 1]

    if (record) {
      // Apply the changes and update the offset
      updateInput(record)
      historyRef.current.offset = Math.max(offset - 1, 0)
    }
  }

  const redoEdit = () => {
    const {stack, offset} = historyRef.current

    // Get the next edit
    const record = stack[offset + 1]

    if (record) {
      // Apply the changes and update the offset
      updateInput(record)
      historyRef.current.offset = Math.min(offset + 1, stack.length - 1)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (onKeyDown) {
      onKeyDown(e)

      if (e.defaultPrevented) {
        return
      }
    }

    if (e.key === 'Escape') {
      e.currentTarget.blur()
    }

    const {value, selectionStart, selectionEnd} = e.currentTarget

    const tabCharacter = (insertSpaces ? ' ' : '\t').repeat(tabSize)

    if (e.key === 'Tab' && !ignoreTabKey && capture) {
      // Prevent focus change
      e.preventDefault()

      if (e.shiftKey) {
        // Unindent selected lines
        const linesBeforeCaret = getLines(value, selectionStart)
        const startLine = linesBeforeCaret.length - 1
        const endLine = getLines(value, selectionEnd).length - 1
        const nextValue = value
          .split('\n')
          .map((line, i) => {
            if (i >= startLine && i <= endLine && line.startsWith(tabCharacter)) {
              return line.substring(tabCharacter.length)
            }

            return line
          })
          .join('\n')

        if (value !== nextValue) {
          const startLineText = linesBeforeCaret[startLine]

          applyEdits({
            value: nextValue,
            // Move the start cursor if first line in selection was modified
            // It was modified only if it started with a tab
            selectionStart: startLineText?.startsWith(tabCharacter)
              ? selectionStart - tabCharacter.length
              : selectionStart,
            // Move the end cursor by total number of characters removed
            selectionEnd: selectionEnd - (value.length - nextValue.length),
          })
        }
      } else if (selectionStart !== selectionEnd) {
        // Indent selected lines
        const linesBeforeCaret = getLines(value, selectionStart)
        const startLine = linesBeforeCaret.length - 1
        const endLine = getLines(value, selectionEnd).length - 1
        const startLineText = linesBeforeCaret[startLine]

        applyEdits({
          value: value
            .split('\n')
            .map((line, i) => {
              if (i >= startLine && i <= endLine) {
                return tabCharacter + line
              }

              return line
            })
            .join('\n'),
          // Move the start cursor by number of characters added in first line of selection
          // Don't move it if it there was no text before cursor
          selectionStart:
            startLineText && /\S/.test(startLineText)
              ? selectionStart + tabCharacter.length
              : selectionStart,
          // Move the end cursor by total number of characters added
          selectionEnd: selectionEnd + tabCharacter.length * (endLine - startLine + 1),
        })
      } else {
        const updatedSelection = selectionStart + tabCharacter.length

        applyEdits({
          // Insert tab character at caret
          value: value.substring(0, selectionStart) + tabCharacter + value.substring(selectionEnd),
          // Update caret position
          selectionStart: updatedSelection,
          selectionEnd: updatedSelection,
        })
      }
    } else if (e.key === 'Backspace') {
      const hasSelection = selectionStart !== selectionEnd
      const textBeforeCaret = value.substring(0, selectionStart)

      if (textBeforeCaret.endsWith(tabCharacter) && !hasSelection) {
        // Prevent default delete behavior
        e.preventDefault()

        const updatedSelection = selectionStart - tabCharacter.length

        applyEdits({
          // Remove tab character at caret
          value:
            value.substring(0, selectionStart - tabCharacter.length) +
            value.substring(selectionEnd),
          // Update caret position
          selectionStart: updatedSelection,
          selectionEnd: updatedSelection,
        })
      }
    } else if (e.key === 'Enter') {
      // Ignore selections
      if (selectionStart === selectionEnd) {
        // Get the current line
        const line = getLines(value, selectionStart).pop()
        const matches = line?.match(/^\s+/)

        if (matches?.[0]) {
          e.preventDefault()

          // Preserve indentation on inserting a new line
          const indent = '\n' + matches[0]
          const updatedSelection = selectionStart + indent.length

          applyEdits({
            // Insert indentation character at caret
            value: value.substring(0, selectionStart) + indent + value.substring(selectionEnd),
            // Update caret position
            selectionStart: updatedSelection,
            selectionEnd: updatedSelection,
          })
        }
      }
    } else if (e.key === '{' || e.key === '(' || e.key === '[' || e.key === '"' || e.key === "'") {
      let chars: string[] | undefined
      if (e.key === '{') {
        chars = ['{', '}']
      } else if (e.key === '(') {
        chars = ['(', ')']
      } else if (e.key === '[') {
        chars = ['[', ']']
      } else if (e.key === '"') {
        chars = ['"', '"']
      } else if (e.key === "'") {
        chars = ["'", "'"]
      }

      // If text is selected, wrap them in the characters
      if (selectionStart !== selectionEnd && chars) {
        e.preventDefault()

        applyEdits({
          value:
            value.substring(0, selectionStart) +
            chars[0] +
            value.substring(selectionStart, selectionEnd) +
            chars[1] +
            value.substring(selectionEnd),
          // Update caret position
          selectionStart,
          selectionEnd: selectionEnd + 2,
        })
      }
    } else if (
      (isMacLike
        ? // Trigger undo with ⌘+Z on Mac
          e.metaKey && e.key === 'z'
        : // Trigger undo with Ctrl+Z on other platforms
          e.ctrlKey && e.key === 'z') &&
      !e.shiftKey &&
      !e.altKey
    ) {
      e.preventDefault()

      undoEdit()
    } else if (
      (isMacLike
        ? // Trigger redo with ⌘+Shift+Z on Mac
          e.metaKey && e.key === 'z' && e.shiftKey
        : isWindows
        ? // Trigger redo with Ctrl+Y on Windows
          e.ctrlKey && e.key === 'y'
        : // Trigger redo with Ctrl+Shift+Z on other platforms
          e.ctrlKey && e.key === 'z' && e.shiftKey) &&
      !e.altKey
    ) {
      e.preventDefault()

      redoEdit()
    } else if (e.key === 'm' && e.ctrlKey && (isMacLike ? e.shiftKey : true)) {
      e.preventDefault()

      // Toggle capturing tab key so users can focus away
      setCapture((prev) => !prev)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const {value, selectionStart, selectionEnd} = e.currentTarget

    recordChange(
      {
        value,
        selectionStart,
        selectionEnd,
      },
      true
    )

    onValueChange(value)
  }

  useEffect(() => {
    recordCurrentState()
  }, [recordCurrentState])

  useImperativeHandle(
    ref,
    () => {
      return {
        get session() {
          return {
            history: historyRef.current,
          }
        },
        set session(session: {history: History}) {
          historyRef.current = session.history
        },
      }
    },
    []
  )

  return (
    <div {...rest} style={{...styles.container, ...style}}>
      <textarea
        ref={inputRef}
        style={{
          ...styles.textarea,
          ...contentStyle,
        }}
        className={className + (textareaClassName ? ` ${textareaClassName}` : '')}
        id={textareaId}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={onClick}
        onKeyUp={onKeyUp}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={disabled}
        form={form}
        maxLength={maxLength}
        minLength={minLength}
        name={name}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        autoFocus={autoFocus}
        autoCapitalize='off'
        autoComplete='off'
        autoCorrect='off'
        spellCheck={false}
        data-gramm={false}
      />
    </div>
  )
})

const styles = {
  container: {
    position: 'relative',
    textAlign: 'left',
    boxSizing: 'border-box',
    padding: 0,
    overflow: 'hidden',
  },
  textarea: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
    resize: 'none',
    color: 'inherit',
    MozOsxFontSmoothing: 'grayscale',
    WebkitFontSmoothing: 'antialiased',
    margin: 0,
    border: 0,
    background: 'none',
    boxSizing: 'inherit',
    display: 'inherit',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontStyle: 'inherit',
    fontVariantLigatures: 'inherit',
    fontWeight: 'inherit',
    letterSpacing: 'inherit',
    lineHeight: 'inherit',
    tabSize: 'inherit',
    textIndent: 'inherit',
    textRendering: 'inherit',
    textTransform: 'inherit',
    whiteSpace: 'pre-wrap',
    wordBreak: 'keep-all',
    overflowWrap: 'break-word',
    userSelect: 'text',
  },
} as const

export default Editor
