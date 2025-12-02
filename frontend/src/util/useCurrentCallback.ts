import {useCallback, useRef, useLayoutEffect} from 'react'

export const useCurrentCallback = <Args extends unknown[], Ret>(fn: (...args: Args) => Ret) => {
  const fnRef = useRef<(...args: Args) => Ret>(fn)
  useLayoutEffect(() => {
    fnRef.current = fn
  })
  const resFn = useCallback((...args: Args) => fnRef.current(...args), [])
  return resFn
}
