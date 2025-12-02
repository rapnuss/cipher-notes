import {useEffect, useId, useMemo, useRef, useState} from 'react'
import {EditorState, EditorSelection, Extension} from '@codemirror/state'
import {
  EditorView,
  keymap,
  drawSelection,
  rectangularSelection,
  crosshairCursor,
  ViewUpdate,
  placeholder as cmPlaceholder,
  Command,
} from '@codemirror/view'
import {defaultKeymap, indentWithTab} from '@codemirror/commands'
import {wrappedLineIndent} from 'codemirror-wrapped-line-indent'
import {selectNextOccurrence} from '@codemirror/search'
import {monospaceStyle} from '../business/misc'
import {CMSelection} from '../business/models'
import {useMyColorScheme} from '../helpers/useMyColorScheme'
import {isDesktop, isIOS} from '../helpers/bowser'
import {hyperLinkStyle, TextToLink} from '../helpers/TextToLink'
import {useCurrentCallback} from '../util/useCurrentCallback'

export type EditorProps = {
  value: string
  selections: CMSelection[]
  onChange: (value: string, selections: CMSelection[]) => void
  onUndo: () => void
  onRedo: () => void
  onUp: () => void
  placeholder?: string
  id?: string
  autoFocus?: boolean
  viewCb: (view: EditorView) => void
}
export const Editor = ({
  value,
  selections,
  onChange,
  onUndo,
  onRedo,
  onUp,
  id,
  placeholder,
  autoFocus,
  viewCb,
}: EditorProps) => {
  const genId = useId()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const applyingRef = useRef(false)
  const isDark = useMyColorScheme() === 'dark'
  const [hasFocus, setHasFocus] = useState(false)
  const viewRef = useRef<EditorView | null>(null)

  if (!id) {
    id = genId
  }
  const focusHintId = `${id}-focus-hint`

  const theme = useMemo<Extension>(
    () =>
      EditorView.theme({
        '&': {backgroundColor: '#0000', outline: 'none', height: '100%'},
        '.cm-cursor, .cm-dropCursor': {
          borderLeft: 'none',
          width: '2px',
          backgroundColor: isDark ? '#fff' : '#000',
        },
        '.cm-content': {
          padding: 0,
          fontFamily: monospaceStyle.fontFamily,
          fontSize: monospaceStyle.fontSize,
          fontWeight: monospaceStyle.fontWeight,
          // Native caret color (used on iOS where we don't draw overlay selection)
          caretColor: isDark ? '#fff' : '#000',
        },
        '.cm-scroller': {fontFamily: monospaceStyle.fontFamily},
        '.cm-line': {
          paddingLeft: 0,
          textIndent: 0,
        },
        '.cm-selectionBackground': {
          backgroundColor: (isDark ? '#fff5' : '#0005') + ' !important',
        },
        '.cm-placeholder': {
          color: isDark ? '#fff' : '#000',
          opacity: 0.5,
        },
      }),
    [isDark]
  )

  const baseExtensions = useMemo<Extension[]>(
    () => [
      theme,
      ...(isIOS() ? [] : [drawSelection()]),
      EditorView.lineWrapping,
      wrappedLineIndent,
      rectangularSelection(),
      crosshairCursor(),
      EditorState.allowMultipleSelections.of(true),
      cmPlaceholder(placeholder ?? ''),
      EditorView.contentAttributes.of({spellcheck: 'true'}),
      EditorView.editorAttributes.of({
        'aria-labelledby': focusHintId,
      }),
      TextToLink,
      hyperLinkStyle,
    ],
    [theme, placeholder, focusHintId]
  )

  const keys = useMemo<Extension>(
    () =>
      keymap.of([
        {
          key: 'Mod-z',
          run: () => {
            onUndo()
            return true
          },
          preventDefault: true,
        },
        {
          key: 'Mod-Shift-z',
          run: () => {
            onRedo()
            return true
          },
          preventDefault: true,
        },
        {
          key: 'Mod-y',
          run: () => {
            onRedo()
            return true
          },
          preventDefault: true,
        },
        {
          key: 'Mod-Alt-ArrowUp',
          linux: 'Shift-Alt-ArrowUp',
          run: addCursorUp,
          preventDefault: true,
        },
        {
          key: 'Mod-Alt-ArrowDown',
          linux: 'Shift-Alt-ArrowDown',
          run: addCursorDown,
          preventDefault: true,
        },
        {
          key: 'ArrowUp',
          run: (view) => {
            const sel = view.state.selection.main
            if (sel.from === 0 && sel.to === 0) {
              onUp()
              return true
            }
            return false
          },
          preventDefault: true,
        },
        {key: 'Mod-d', run: selectNextOccurrence, preventDefault: true},
        ...defaultKeymap,
        indentWithTab,
      ]),
    [onUndo, onRedo, onUp]
  )

  const updates = useMemo<Extension>(
    () =>
      // eslint-disable-next-line react-hooks/refs
      EditorView.updateListener.of((u: ViewUpdate) => {
        if (applyingRef.current) return
        if (u.docChanged || u.selectionSet) {
          const doc = u.state.doc.toString()
          const sels = u.state.selection.ranges.map((r) => ({anchor: r.anchor, head: r.head}))
          onChange(doc, sels)
        }
        // Show/hide focus hint when focus changes
        if (u.focusChanged) {
          setHasFocus(u.view.hasFocus)
        }
      }),
    [onChange]
  )

  const onMount = useCurrentCallback(() => {
    if (!hostRef.current) throw new Error('hostRef.current is null')

    const clamp = (n: number) => Math.max(0, Math.min(n, value.length))
    const initialSelection = selections?.length
      ? EditorSelection.create(
          selections.map((s) => EditorSelection.range(clamp(s.anchor), clamp(s.head)))
        )
      : EditorSelection.cursor(value.length)

    const state = EditorState.create({
      doc: value,
      selection: initialSelection,
      extensions: [...baseExtensions, keys, updates],
    })

    const view = new EditorView({state, parent: hostRef.current})
    viewRef.current = view
    viewCb(view)

    // Set initial focus state
    setHasFocus(view.hasFocus)

    if (autoFocus) {
      setTimeout(() => {
        view.focus()
        setHasFocus(true)
      }, 100)
    }

    return view
  })

  useEffect(() => {
    const view = onMount()

    return () => {
      view.destroy()
      viewRef.current = null
      setHasFocus(false)
    }
  }, [baseExtensions, onMount])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const curDoc = view.state.doc.toString()
    const needDoc = value !== curDoc

    const curSels = view.state.selection.ranges.map((r) => ({anchor: r.anchor, head: r.head}))
    const selsEqual =
      selections.length === curSels.length &&
      selections.every((s, i) => s.anchor === curSels[i]!.anchor && s.head === curSels[i]!.head)

    const trSpec: any = {}
    if (needDoc) {
      trSpec.changes = {from: 0, to: curDoc.length, insert: value}
    }
    if (!selsEqual) {
      const docLen = needDoc ? value.length : curDoc.length
      const clamp = (n: number) => Math.max(0, Math.min(n, docLen))
      trSpec.selection = EditorSelection.create(
        selections.map((s) => EditorSelection.range(clamp(s.anchor), clamp(s.head)))
      )
      trSpec.scrollIntoView = true
    }

    if (needDoc || !selsEqual) {
      applyingRef.current = true
      view.dispatch(trSpec)
      applyingRef.current = false
    }
  }, [value, selections])

  return (
    <div
      id={id}
      style={{flex: '1 1 0', position: 'relative', minHeight: 0, overflow: 'hidden'}}
      ref={hostRef}
    >
      {isDesktop() && hasFocus && (
        <div
          id={focusHintId}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 20,
            opacity: 0.5,
            fontSize: 'var(--mantine-font-size-sm)',
          }}
        >
          esc to remove focus
        </div>
      )}
    </div>
  )
}

const createAddCursor =
  (direction: 'up' | 'down'): Command =>
  (view) => {
    const forward = direction === 'down'

    let selection = view.state.selection

    for (const r of selection.ranges) {
      selection = selection.addRange(view.moveVertically(r, forward))
    }

    view.dispatch({selection})

    return true
  }

const addCursorUp = createAddCursor('up')
const addCursorDown = createAddCursor('down')
