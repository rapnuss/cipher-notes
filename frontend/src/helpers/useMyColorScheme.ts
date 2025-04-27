import {useMantineColorScheme} from '@mantine/core'
import {getColorScheme} from '../util/misc'
import {useEffect} from 'react'

export const useMyColorScheme = (): 'dark' | 'light' => {
  const {colorScheme, setColorScheme} = useMantineColorScheme()
  const isAuto = colorScheme === 'auto'
  useEffect(() => {
    if (isAuto) {
      const systemScheme = getColorScheme()
      setColorScheme(systemScheme)
    }
  }, [isAuto, setColorScheme])
  if (isAuto) {
    const systemScheme = getColorScheme()
    return systemScheme
  }
  return colorScheme
}
