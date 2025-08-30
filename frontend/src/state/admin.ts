import {setState} from './store'

export type AdminState = {
  open: boolean
}
export const adminInit: AdminState = {
  open: false,
}

export const openAdminDialog = () => {
  setState((state) => {
    state.admin.open = true
  })
}
export const closeAdminDialog = () => {
  setState((state) => {
    state.admin.open = false
  })
}
