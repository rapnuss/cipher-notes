import {useMantineColorScheme} from '@mantine/core'
import {getColorScheme} from '../util/misc'
import {useEffect} from 'react'
import {ThemeName} from '../business/models'
import {useSelector} from '../state/store'

const matcher = window.matchMedia('(prefers-color-scheme: dark)')

/** Use this only once in the app */
export const useSetColorSchemeAndListenForChange = () => {
  const {colorScheme, setColorScheme} = useMantineColorScheme()
  const isAuto = colorScheme === 'auto'
  useEffect(() => {
    if (isAuto) {
      setColorScheme(getColorScheme())
    }
  }, [isAuto, setColorScheme])
  useEffect(() => {
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setColorScheme('dark')
      } else {
        setColorScheme('light')
      }
    }
    matcher.addEventListener('change', handler)
    return () => matcher.removeEventListener('change', handler)
  }, [setColorScheme])
}

export const useMyColorScheme = (): 'dark' | 'light' => {
  const {colorScheme} = useMantineColorScheme()
  const isAuto = colorScheme === 'auto'
  if (isAuto) {
    const systemScheme = getColorScheme()
    return systemScheme
  }
  return colorScheme
}

export const useThemeName = (): ThemeName => {
  const cs = useMyColorScheme()
  const options = useSelector((state) => state.settings.options)
  if (cs === 'dark') {
    return options.darkTheme
  }
  return options.lightTheme
}
