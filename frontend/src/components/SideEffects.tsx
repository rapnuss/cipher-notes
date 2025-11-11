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
  useSetColorSchemeAndListenForChange()
  const themeName = useThemeName()
  useEffect(() => {
    document.documentElement.setAttribute('data-theme-name', themeName)
    const isMinimalTheme = themeName === 'white' || themeName === 'black'
    if (isMinimalTheme) {
      document.documentElement.style.setProperty('--mantine-radius-xs', '0')
      document.documentElement.style.setProperty('--mantine-radius-sm', '0')
      document.documentElement.style.setProperty('--mantine-radius-md', '0')
      document.documentElement.style.setProperty('--mantine-radius-lg', '0')
      document.documentElement.style.setProperty('--mantine-radius-xl', '0')
      document.documentElement.style.setProperty('--mantine-radius-default', '0')
    } else {
      document.documentElement.style.removeProperty('--mantine-radius-xs')
      document.documentElement.style.removeProperty('--mantine-radius-sm')
      document.documentElement.style.removeProperty('--mantine-radius-md')
      document.documentElement.style.removeProperty('--mantine-radius-lg')
      document.documentElement.style.removeProperty('--mantine-radius-xl')
      document.documentElement.style.removeProperty('--mantine-radius-default')
    }
  }, [themeName])
  return null
}
