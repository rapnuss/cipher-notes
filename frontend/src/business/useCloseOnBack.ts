import {useEffect, useRef} from 'react'
import {useSelector} from '../state/store'
import {popHistory, pushHistory, removeHistory} from '../state/history'

export type UseDialogBackHandlerProps = {
  id: string
  open: boolean
  onClose: () => void
}

export function useCloseOnBack({id, open, onClose}: UseDialogBackHandlerProps) {
  const {stack} = useSelector((state) => state.history)
  const prevOpen = useRef(false)
  const top = stack[stack.length - 1]

  useEffect(() => {
    const wasOpen = prevOpen.current
    prevOpen.current = open
    if (open && !wasOpen) {
      window.history.pushState({dialogId: id}, '')
      pushHistory(id)
    } else if (!open && wasOpen) {
      removeHistory(id)
      if (window.history.state?.dialogId === id) {
        window.history.back()
      }
    }
  }, [open, id])

  useEffect(() => {
    const handlePop = () => {
      if (top === id && prevOpen.current) {
        popHistory()
        onClose()
      }
    }
    window.addEventListener('popstate', handlePop)
    return () => void window.removeEventListener('popstate', handlePop)
  }, [id, onClose, top])
}
