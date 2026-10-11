export type ElementScrollPosition = {top: number; left: number}

const SAVE_DELAY_MS = 300

export const observeScrollPosition = (
  element: HTMLElement,
  initialPosition: ElementScrollPosition,
  onPositionChange: (position: ElementScrollPosition) => unknown,
): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null

  element.scrollTop = initialPosition.top
  element.scrollLeft = initialPosition.left
  let lastPosition = {top: element.scrollTop, left: element.scrollLeft}

  const save = () => {
    onPositionChange(lastPosition)
  }
  const saveCurrent = () => {
    lastPosition = {top: element.scrollTop, left: element.scrollLeft}
    save()
  }
  const scheduleSave = () => {
    lastPosition = {top: element.scrollTop, left: element.scrollLeft}
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      save()
    }, SAVE_DELAY_MS)
  }

  element.addEventListener('scroll', scheduleSave, {passive: true})
  window.addEventListener('pagehide', saveCurrent)

  return () => {
    element.removeEventListener('scroll', scheduleSave)
    window.removeEventListener('pagehide', saveCurrent)
    if (timer !== null) clearTimeout(timer)
    save()
  }
}

export const observeChildIndex = (
  element: HTMLElement,
  initChildIndex: number,
  onPositionChange: (childIndex: number) => unknown,
): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null
  element.children[initChildIndex]?.scrollIntoView({behavior: 'instant'})
  let lastPosition = initChildIndex

  const save = () => {
    onPositionChange(lastPosition)
  }
  const saveCurrent = () => {
    const {x, y} = element.getBoundingClientRect()
    const row = document.elementFromPoint(x + 1, y + 1)
    const index = Array.prototype.indexOf.call(element.children, row)
    lastPosition = index === -1 ? initChildIndex : index
    save()
  }
  const scheduleSave = () => {
    const {x, y} = element.getBoundingClientRect()
    const row = document.elementFromPoint(x + 1, y + 1)
    const index = Array.prototype.indexOf.call(element.children, row)
    lastPosition = index === -1 ? initChildIndex : index
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      save()
    }, SAVE_DELAY_MS)
  }

  element.addEventListener('scroll', scheduleSave, {passive: true})
  window.addEventListener('pagehide', saveCurrent)

  return () => {
    element.removeEventListener('scroll', scheduleSave)
    window.removeEventListener('pagehide', saveCurrent)
    if (timer !== null) clearTimeout(timer)
    save()
  }
}
