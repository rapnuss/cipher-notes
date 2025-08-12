import {editor, ISelection, KeyCode, KeyMod} from 'monaco-editor'
import Editor, {BeforeMount, OnMount} from '@monaco-editor/react'
import {useEffect, useRef} from 'react'
import {initialSelection} from '../business/models'
import {useMyColorScheme} from '../helpers/useMyColorScheme'

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
  const colorScheme = useMyColorScheme()

  const onMount: OnMount = (editor) => {
    editorRef.current = editor

    editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyZ, onUndo)
    editor.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ, onRedo)
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyY, onRedo)
  }

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

  useEffect(() => {
    const currentSelections = editorRef.current?.getSelections() ?? [
      editorRef.current?.getSelection() ?? initialSelection,
    ]
    if (!sameSelections(currentSelections, selections)) {
      editorRef.current?.setSelections(selections)
    }
  }, [selections])

  return (
    <Editor
      className={className}
      height='100%'
      width='100%'
      value={value}
      onChange={(v) => {
        const selections = editorRef.current?.getSelections() ?? [
          editorRef.current?.getSelection() ?? initialSelection,
        ]
        onChange(v ?? '', selections)
      }}
      onMount={onMount}
      beforeMount={beforeMount}
      theme={colorScheme === 'dark' ? 'my-dark' : 'my-light'}
      options={{
        minimap: {enabled: false},
        lineNumbers: 'off',
        wordWrap: 'on',
        wrappingIndent: 'indent',
        folding: false,
        glyphMargin: false,
        lineDecorationsWidth: 0,
      }}
    />
  )
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
