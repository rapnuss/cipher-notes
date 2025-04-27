import {useEffect, useRef} from 'react'
import {getState} from '../state/store'
import {popHistory, pushHistory, removeHistory, setIgnorePop} from '../state/history'
import {last} from '../util/misc'

export type UseDialogBackHandlerProps = {
  id: string
  open: boolean
  onClose: () => void
}

export function useCloseOnBack({id, open, onClose}: UseDialogBackHandlerProps) {
  const prevOpen = useRef(false)

  useEffect(() => {
    const wasOpen = prevOpen.current
    prevOpen.current = open
    if (open && !wasOpen) {
      window.history.pushState({dialogId: id}, '')
      pushHistory(id)
    } else if (!open && wasOpen) {
      removeBrowserHistory(id)
    }
  }, [open, id])

  useEffect(() => {
    const handlePop = () => {
      const state = getState()
      if (state.history.ignorePop) {
        return
      }
      const top = last(state.history.stack)
      if (top === id && prevOpen.current) {
        popHistory()
        onClose()
      }
    }
    window.addEventListener('popstate', handlePop)
    return () => void window.removeEventListener('popstate', handlePop)
  }, [id, onClose])
}

export const removeBrowserHistory = (id: string) => {
  removeHistory(id)
  if (window.history.state?.dialogId === id) {
    setIgnorePop(true)
    window.history.back()
    setTimeout(() => setIgnorePop(false), 100)
  }
}

export const closeOnBack = (id: string, onClose: () => void) => {
  window.history.pushState({dialogId: id}, '')
  pushHistory(id)

  const handlePop = () => {
    const state = getState()
    if (state.history.ignorePop) {
      return
    }
    const top = last(state.history.stack)
    if (top === id) {
      popHistory()
      onClose()
    }
  }
  window.addEventListener('popstate', handlePop)
  return () => window.removeEventListener('popstate', handlePop)
}
