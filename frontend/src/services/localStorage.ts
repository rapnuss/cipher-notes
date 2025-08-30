import {ActiveLabel} from '../business/models'
import {NotesState} from '../state/notes'
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
    const openNoteId = localStorage.getItem('openNoteId')
    const openFileId = localStorage.getItem('openFileId')
    return openFileId ? null : openNoteId
  })

export const storeOpenFileId = (id: string | null): Promise<void> =>
  Promise.resolve().then(() => {
    if (id === null) {
      localStorage.removeItem('openFileId')
    } else {
      localStorage.setItem('openFileId', id)
    }
  })

export const loadOpenFileId = (): Promise<string | null> =>
  Promise.resolve().then(() => {
    const openFileId = localStorage.getItem('openFileId')
    const openNoteId = localStorage.getItem('openNoteId')
    return openNoteId ? null : openFileId
  })

export const storeActiveLabelId = (labelId: string | false | null): Promise<void> =>
  Promise.resolve().then(() => {
    localStorage.setItem('activeLabelId', JSON.stringify(labelId))
  })

export const loadActiveLabelId = (): Promise<ActiveLabel> =>
  Promise.resolve().then(() => {
    const labelIdStr = localStorage.getItem('activeLabelId')
    const legacyActiveLabel = labelIdStr ? JSON.parse(labelIdStr) : 'all'
    const activeLabel: ActiveLabel =
      legacyActiveLabel === null
        ? 'all'
        : legacyActiveLabel === false
        ? 'unlabeled'
        : legacyActiveLabel
    return activeLabel
  })
