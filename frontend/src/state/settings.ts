import {loadSettings, storeSettings} from '../services/localStorage'
import {debounce} from '../util/misc'
import {setState, subscribe} from './store'

export type SettingsState = {
  open: boolean
  settings: object
}
export const settingsInit: SettingsState = {
  open: false,
  settings: {},
}

loadSettings().then((settings) => {
  if (settings) {
    setState((state) => {
      state.settings.settings = {
        ...state.settings.settings,
        ...settings,
      }
    })
  }
})

export const openSettingsDialog = () => {
  setState((state) => {
    state.settings.open = true
  })
}
export const closeSettingsDialog = () => {
  setState((state) => {
    state.settings.open = false
  })
}

const storeSettingsDebounced = debounce(storeSettings, 250)

export const registerSettingsSubscriptions = () => {
  subscribe(
    (state) => state.settings.settings,
    (settings) => storeSettingsDebounced(settings)
  )
}
