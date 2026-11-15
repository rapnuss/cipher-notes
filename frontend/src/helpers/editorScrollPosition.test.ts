import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {EditorView} from '@codemirror/view'
import {getEditorScrollPosition, restoreEditorScrollPosition} from './editorScrollPosition'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(0), 16))
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const createView = () => {
  const measurements: {read: () => number; write: (top: number) => void}[] = []
  const view = {
    scrollDOM: {scrollTop: 4000, scrollLeft: 10},
    state: {doc: {length: 10000}},
    lineBlockAtHeight: () => ({from: 500, top: 2200}),
    lineBlockAt: vi.fn(() => ({top: 2300})),
    dispatch: vi.fn(),
    requestMeasure: vi.fn((request) => measurements.push(request)),
  }
  return {view, editor: view as unknown as EditorView, measurements}
}

describe('editor scroll restoration', () => {
  it('restores an offset larger than the viewport after measuring the anchor', () => {
    const {view, editor, measurements} = createView()
    const position = getEditorScrollPosition(editor)
    expect(position).toEqual({type: 'editor', anchor: 500, offset: -1800})
    if (position.type !== 'editor') throw new Error('Expected an editor position')
    const onRestored = vi.fn()
    restoreEditorScrollPosition(editor, position, onRestored)
    expect(onRestored).not.toHaveBeenCalled()
    vi.advanceTimersByTime(16)
    const measurement = measurements[0]!
    measurement.write(measurement.read())
    // The paragraph starts 100 px lower after reopening, but the offset is kept.
    expect(view.scrollDOM.scrollTop).toBe(4100)
    expect(view.scrollDOM.scrollLeft).toBe(0)
    expect(view.lineBlockAt).toHaveBeenCalledWith(500)
    expect(onRestored).toHaveBeenCalledOnce()
  })

  it('does not measure or save after closing before restoration starts', () => {
    const {view, editor} = createView()
    const onRestored = vi.fn()
    const cancel = restoreEditorScrollPosition(
      editor,
      {type: 'editor', anchor: 500, offset: -1800},
      onRestored,
    )
    cancel()
    vi.advanceTimersByTime(100)
    expect(view.requestMeasure).not.toHaveBeenCalled()
    expect(onRestored).not.toHaveBeenCalled()
  })

  it('ignores a queued measurement after closing the editor', () => {
    const {view, editor, measurements} = createView()
    const onRestored = vi.fn()
    const cancel = restoreEditorScrollPosition(
      editor,
      {type: 'editor', anchor: 500, offset: -1800},
      onRestored,
    )
    vi.advanceTimersByTime(16)
    cancel()
    const measurement = measurements[0]!
    measurement.write(measurement.read())
    expect(view.scrollDOM.scrollTop).toBe(4000)
    expect(onRestored).not.toHaveBeenCalled()
  })
})
