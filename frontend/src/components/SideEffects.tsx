import {useEffect} from 'react'
import {useHotkeys} from '@mantine/hooks'
import {notifications} from '@mantine/notifications'

import {useSetColorSchemeAndListenForChange, useThemeName} from '../helpers/useMyColorScheme'
import {debounce, delay} from '../util/misc.ts'

window.addEventListener(
  'scroll',
  debounce(() => scrollTo(0, 0), 0)
)

if (window.visualViewport) {
  window.visualViewport.addEventListener(
    'resize',
    debounce(() => {
      document.documentElement.style.setProperty(
        '--viewport-height',
        `${window.visualViewport?.height}px`
      )
    }, 0)
  )
} else {
  window.addEventListener(
    'resize',
    debounce(() => {
      document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`)
    }, 0)
  )
}

document.addEventListener(
  'focus',
  async (e) => {
    const target = e.target as HTMLElement
    if (!(target instanceof HTMLTextAreaElement)) {
      return
    }
    await delay(300)
    target.scrollIntoView({behavior: 'smooth', block: 'nearest'})
  },
  true
)

export const SideEffects = () => {
  useHotkeys([['Escape', () => notifications.clean()]], [], true)
  useSetColorSchemeAndListenForChange(100)
  const themeName = useThemeName()
  useEffect(() => {
    const doc = document.documentElement
    doc.setAttribute('data-theme-name', themeName)
  }, [themeName])
  return null
}
