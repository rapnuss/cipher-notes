import {EditorView} from '@codemirror/view'
import {NoteScrollPosition} from '../business/models'

export const getEditorScrollPosition = (
  view: EditorView,
  scrollTop = view.scrollDOM.scrollTop,
): NoteScrollPosition => {
  // Match CodeMirror's own scroll snapshot anchoring, which samples just
  // inside the viewport to avoid choosing the line immediately above it.
  const anchor = view.lineBlockAtHeight(scrollTop + 8)
  return {type: 'editor', anchor: anchor.from, offset: anchor.top - scrollTop}
}
