import {SettingsOptions} from '../business/models'
import {loadSettingsOptions, storeSettingsOptions} from '../services/localStorage'
import {setState, subscribe} from './store'

export type SettingsState = {
  open: boolean
  options: SettingsOptions
}

export const settingsInit: SettingsState = {
  open: false,
  options: {
    lightTheme: 'light',
    darkTheme: 'dark',
  },
}

loadSettingsOptions().then((options) => {
  if (options) {
    setState((state) => {
      state.settings.options = options
    })
  }
})

export const openSettings = () =>
  setState((state) => {
    state.settings.open = true
  })

export const closeSettings = () =>
  setState((state) => {
    state.settings.open = false
  })

export const setLightTheme = (theme: 'light' | 'white') =>
  setState((state) => {
    state.settings.options.lightTheme = theme
  })

export const setDarkTheme = (theme: 'dark' | 'black') =>
  setState((state) => {
    state.settings.options.darkTheme = theme
  })

export const registerSettingsSubscriptions = () => {
  subscribe((state) => state.settings.options, storeSettingsOptions)
}
