import {throttle} from './misc'

export type ElementScrollPosition = {top: number; left: number}
export type ChildScrollPosition = {index: number; offset?: number}

const SAVE_INTERVAL_MS = 300

const observePosition = <Position>(
  element: HTMLElement,
  read: () => Position,
  onPositionChange: (position: Position) => unknown,
): (() => void) => {
  let lastPosition = read()
  const save = () => onPositionChange(lastPosition)
  const saveThrottled = throttle(save, SAVE_INTERVAL_MS)
  const onScroll = () => {
    lastPosition = read()
    saveThrottled()
  }
  const saveCurrent = () => {
    lastPosition = read()
    saveThrottled.cancel()
    save()
  }

  element.addEventListener('scroll', onScroll, {passive: true})
  window.addEventListener('pagehide', saveCurrent)

  return () => {
    element.removeEventListener('scroll', onScroll)
    window.removeEventListener('pagehide', saveCurrent)
    saveThrottled.cancel()
    // Retain the last observed value: the DOM may already be removed on cleanup.
    save()
  }
}

export const observeScrollPosition = (
  element: HTMLElement,
  initialPosition: ElementScrollPosition,
  onPositionChange: (position: ElementScrollPosition) => unknown,
): (() => void) => {
  element.scrollTop = initialPosition.top
  element.scrollLeft = initialPosition.left
  return observePosition(
    element,
    () => ({top: element.scrollTop, left: element.scrollLeft}),
    onPositionChange,
  )
}

export const observeChildIndex = (
  element: HTMLElement,
  initialPosition: ChildScrollPosition,
  onPositionChange: (position: ChildScrollPosition) => unknown,
): (() => void) => {
  const viewportTop = () => element.getBoundingClientRect().top + element.clientTop
  const index = Math.max(0, Math.min(initialPosition.index, element.children.length - 1))
  const child = element.children[index]
  if (child) {
    element.scrollTop +=
      child.getBoundingClientRect().top - viewportTop() + (initialPosition.offset ?? 0)
  }

  return observePosition(
    element,
    () => {
      if (element.children.length === 0) return {index: 0, offset: 0}
      const top = viewportTop()
      let low = 0
      let high = element.children.length - 1
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        if (element.children[middle]!.getBoundingClientRect().top <= top) low = middle
        else high = middle - 1
      }
      return {index: low, offset: top - element.children[low]!.getBoundingClientRect().top}
    },
    onPositionChange,
  )
}
