import {setState} from './store'

export type HistoryState = {
  stack: string[]
  ignorePop: boolean
}

export const historyInit: HistoryState = {
  stack: [],
  ignorePop: false,
}

export const pushHistory = (id: string) =>
  setState((state) => {
    state.history.stack.push(id)
  })

export const popHistory = () =>
  setState((state) => {
    state.history.stack.pop()
  })

export const removeHistory = (id: string) =>
  setState((state) => {
    state.history.stack = state.history.stack.filter((item) => item !== id)
  })

export const setIgnorePop = (ignorePop: boolean) =>
  setState((state) => {
    state.history.ignorePop = ignorePop
  })
