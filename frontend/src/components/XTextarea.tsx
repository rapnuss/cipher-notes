import {editor, ISelection, KeyCode, KeyMod, Selection} from 'monaco-editor'
import Editor, {BeforeMount, OnMount} from '@monaco-editor/react'
import {useEffect, useRef} from 'react'
import {initialSelection} from '../business/models'
import {useMyColorScheme} from '../helpers/useMyColorScheme'
import {monospaceStyle} from '../business/misc'

export type XTextareaProps = {
  value: string
  selections: ISelection[]
  onChange: (value: string, selections: ISelection[]) => void
  onUndo: () => void
  onRedo: () => void
  onUp: () => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}
export const XTextarea = ({
  value,
  selections,
  onChange,
  onUndo,
  onRedo,
  className,
}: XTextareaProps) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const applyingRef = useRef(false)
  const colorScheme = useMyColorScheme()

  const beforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme('my-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#00000000',
        'editor.foreground': '#000000',
        focusBorder: '#0000',
      },
    })
    monaco.editor.defineTheme('my-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#00000000',
        'editor.foreground': '#ffffff',
        focusBorder: '#0000',
      },
    })
  }

  const onMount: OnMount = (editor) => {
    editorRef.current = editor

    editor.onDidChangeModelContent(() => {
      if (applyingRef.current) return // avoid feedback loops
      onChange(editor.getValue(), getSelections(editor))
    })

    editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyZ, onUndo)
    editor.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ, onRedo)
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyY, onRedo)
  }

  const applySnapshot = (text: string, selections: ISelection[]) => {
    const editor = editorRef.current
    if (!editor) return
    const model = editor.getModel()
    if (!model) return
    const full = model.getFullModelRange() // entire buffer range
    // create undo stops around the custom edit
    editor.pushUndoStop()
    applyingRef.current = true
    editor.executeEdits(
      'custom-history',
      [{range: full, text: text, forceMoveMarkers: true}],
      selections.map(
        // restores multi-cursor selection(s)
        (s) =>
          new Selection(
            s.selectionStartLineNumber,
            s.selectionStartColumn,
            s.positionLineNumber,
            s.positionColumn
          )
      )
    )
    applyingRef.current = false
    editor.pushUndoStop()
  }

  useEffect(() => {
    const currentSelections = getSelections(editorRef.current)
    const currentValue = editorRef.current?.getValue() ?? ''
    if (!sameSelections(currentSelections, selections) || currentValue !== value) {
      applySnapshot(value, selections)
    }
  }, [selections, value])

  return (
    <Editor
      className={className}
      height='100%'
      width='100%'
      defaultValue={value}
      onMount={onMount}
      beforeMount={beforeMount}
      theme={colorScheme === 'dark' ? 'my-dark' : 'my-light'}
      options={{
        minimap: {enabled: false},
        stickyScroll: {enabled: false},
        lineNumbers: 'off',
        wordWrap: 'on',
        wrappingIndent: 'indent',
        folding: false,
        glyphMargin: false,
        lineDecorationsWidth: 0,
        fontFamily: monospaceStyle.fontFamily,
        fontSize: monospaceStyle.fontSize,
        fontWeight: monospaceStyle.fontWeight,
        tabSize: 2,
        insertSpaces: true,
      }}
    />
  )
}

function getSelections(editor: editor.IStandaloneCodeEditor | null): ISelection[] {
  if (!editor) return [initialSelection]
  const selections = editor.getSelections() ?? [editor.getSelection() ?? initialSelection]
  if (selections.length === 0) return [initialSelection]
  return selections
}

function sameSelections(a: ISelection[], b: ISelection[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!,
      y = b[i]!
    if (
      x.selectionStartLineNumber !== y.selectionStartLineNumber ||
      x.selectionStartColumn !== y.selectionStartColumn ||
      x.positionLineNumber !== y.positionLineNumber ||
      x.positionColumn !== y.positionColumn
    )
      return false
  }
  return true
}
