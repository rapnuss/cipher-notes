import {NotesState} from '../state/notes'
import {SettingsState} from '../state/settings'
import {UserState} from '../state/user'

export const storeUser = (user: UserState['user']): Promise<void> =>
  Promise.resolve().then(() => {
    localStorage.setItem('user', JSON.stringify(user))
  })

export const loadUser = (): Promise<UserState['user'] | null> =>
  Promise.resolve().then(() => {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
  })

export const storeSettings = (settings: SettingsState['settings']): Promise<void> =>
  Promise.resolve().then(() => {
    localStorage.setItem('settings', JSON.stringify(settings))
  })

export const loadSettings = (): Promise<Partial<SettingsState['settings']> | null> =>
  Promise.resolve().then(() => {
    const settingsStr = localStorage.getItem('settings')
    return settingsStr ? JSON.parse(settingsStr) : null
  })

export const storeNotesSortOrder = (sort: NotesState['sort']): Promise<void> =>
  Promise.resolve().then(() => {
    localStorage.setItem('notesSortOrder', JSON.stringify(sort))
  })

export const loadNotesSortOrder = (): Promise<NotesState['sort'] | null> =>
  Promise.resolve().then(() => {
    const sortStr = localStorage.getItem('notesSortOrder')
    return sortStr ? JSON.parse(sortStr) : null
  })

export const storeOpenNoteId = (id: string | null): Promise<void> =>
  Promise.resolve().then(() => {
    if (id === null) {
      localStorage.removeItem('openNoteId')
    } else {
      localStorage.setItem('openNoteId', id)
    }
  })

export const loadOpenNoteId = (): Promise<string | null> =>
  Promise.resolve().then(() => {
    return localStorage.getItem('openNoteId')
  })

export const storeActiveLabelId = (labelId: string | false | null): Promise<void> =>
  Promise.resolve().then(() => {
    localStorage.setItem('activeLabelId', JSON.stringify(labelId))
  })

export const loadActiveLabelId = (): Promise<string | false | null> =>
  Promise.resolve().then(() => {
    const labelIdStr = localStorage.getItem('activeLabelId')
    return labelIdStr ? JSON.parse(labelIdStr) : null
  })
