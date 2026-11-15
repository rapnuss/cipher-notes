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

export const restoreEditorScrollPosition = (
  view: EditorView,
  position: Extract<NoteScrollPosition, {type: 'editor'}>,
  onRestored: () => void,
): (() => void) => {
  const anchor = Math.max(0, Math.min(position.anchor, view.state.doc.length))
  let canceled = false
  // Render the anchor first. yMargin is clamped to the viewport height, so it
  // cannot represent positions deep inside a long wrapped paragraph.
  view.dispatch({
    effects: EditorView.scrollIntoView(anchor, {y: 'start', x: 'start', yMargin: 0, xMargin: 0}),
  })
  const frame = requestAnimationFrame(() => {
    if (canceled) return
    view.requestMeasure({
      read: () => (canceled ? 0 : view.lineBlockAt(anchor).top - position.offset),
      write: (top) => {
        if (canceled) return
        view.scrollDOM.scrollTop = top
        view.scrollDOM.scrollLeft = 0
        onRestored()
      },
    })
  })
  return () => {
    canceled = true
    cancelAnimationFrame(frame)
  }
}
