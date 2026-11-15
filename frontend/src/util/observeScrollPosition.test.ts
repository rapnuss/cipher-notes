import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {observeChildIndex, observeScrollPosition} from './observeScrollPosition'

class Scroller extends EventTarget {
  scrollTop = 0
  scrollLeft = 0
  clientTop = 2
  children: {getBoundingClientRect: () => {top: number}}[]

  constructor(rowTops = [0]) {
    super()
    this.children = rowTops.map((top) => ({
      getBoundingClientRect: () => ({top: 100 + this.clientTop + top - this.scrollTop}),
    }))
  }

  getBoundingClientRect = () => ({top: 100})
  get element() {
    return this as unknown as HTMLElement
  }
  scrollTo(top: number) {
    this.scrollTop = top
    this.dispatchEvent(new Event('scroll'))
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', new EventTarget())
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('scroll position persistence', () => {
  it('saves periodically while scrolling continues, using the latest position', () => {
    const scroller = new Scroller()
    const save = vi.fn()
    const cleanup = observeScrollPosition(scroller.element, {top: 0, left: 0}, save)
    scroller.scrollTo(10)
    expect(save).toHaveBeenLastCalledWith({top: 10, left: 0})
    vi.advanceTimersByTime(100)
    scroller.scrollTo(20)
    vi.advanceTimersByTime(100)
    scroller.scrollTo(30)
    vi.advanceTimersByTime(100)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith({top: 30, left: 0})
    scroller.scrollTo(40)
    vi.advanceTimersByTime(300)
    expect(save).toHaveBeenLastCalledWith({top: 40, left: 0})
    cleanup()
  })

  it('flushes on close and prevents late saves even after the DOM is reset', () => {
    const scroller = new Scroller()
    const save = vi.fn()
    const cleanup = observeScrollPosition(scroller.element, {top: 0, left: 0}, save)
    scroller.scrollTo(10)
    scroller.scrollTo(200)
    scroller.scrollTop = 0
    cleanup()
    expect(save).toHaveBeenLastCalledWith({top: 200, left: 0})
    const count = save.mock.calls.length
    vi.advanceTimersByTime(1000)
    scroller.scrollTo(400)
    window.dispatchEvent(new Event('pagehide'))
    expect(save).toHaveBeenCalledTimes(count)
  })

  it('reads and saves the current position immediately on pagehide', () => {
    const scroller = new Scroller()
    const save = vi.fn()
    const cleanup = observeScrollPosition(scroller.element, {top: 0, left: 0}, save)
    scroller.scrollTo(10)
    scroller.scrollTo(20)
    scroller.scrollTop = 300
    window.dispatchEvent(new Event('pagehide'))
    expect(save).toHaveBeenLastCalledWith({top: 300, left: 0})
    const count = save.mock.calls.length
    vi.advanceTimersByTime(1000)
    expect(save).toHaveBeenCalledTimes(count)
    cleanup()
  })
})

describe('wrapped text positions', () => {
  it('round-trips a position deep inside a single wrapped line', () => {
    const first = new Scroller()
    const save = vi.fn()
    const cleanup = observeChildIndex(first.element, {index: 0}, save)
    first.scrollTo(1800)
    cleanup()
    expect(save).toHaveBeenLastCalledWith({index: 0, offset: 1800})

    const reopened = new Scroller()
    const stop = observeChildIndex(reopened.element, save.mock.lastCall![0], vi.fn())
    expect(reopened.scrollTop).toBe(1800)
    stop()
  })

  it('restores the row and offset after preceding rows change height', () => {
    const first = new Scroller([0, 3000, 6000])
    const save = vi.fn()
    const cleanup = observeChildIndex(first.element, {index: 1, offset: 1800}, save)
    expect(first.scrollTop).toBe(4800)
    cleanup()

    const reopened = new Scroller([0, 4000, 7000])
    const stop = observeChildIndex(reopened.element, save.mock.lastCall![0], vi.fn())
    expect(reopened.scrollTop).toBe(5800)
    stop()
  })

  it('accepts positions saved before offsets were added', () => {
    const scroller = new Scroller([0, 500, 900])
    const cleanup = observeChildIndex(scroller.element, {index: 1}, vi.fn())
    expect(scroller.scrollTop).toBe(500)
    cleanup()
  })

  it('clamps a row index when the file has become shorter', () => {
    const scroller = new Scroller([0, 500])
    const cleanup = observeChildIndex(scroller.element, {index: 99}, vi.fn())
    expect(scroller.scrollTop).toBe(500)
    cleanup()
  })
})
