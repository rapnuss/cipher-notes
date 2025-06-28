import {db} from '../db'
import {setState} from './store'

export type FilesState = {
  importing: boolean
  openFile: {
    id: string
    title: string
    updated_at: number
    version: number
  } | null
}
export const filesInit = {
  importing: false,
  openFile: null,
}

export const setFilesImporting = (importing: boolean) =>
  setState((state) => {
    state.files.importing = importing
  })

export const setFileArchived = (id: string, archived: boolean) =>
  db.files_meta
    .where('id')
    .equals(id)
    .modify((file) => {
      file.archived = archived ? 1 : 0
      file.updated_at = Date.now()
      if (file.state === 'synced') {
        file.version++
      }
    })

export const deleteFile = async (id: string) => {
  const file = await db.files_meta.get(id)
  if (!file) {
    return
  }
  db.transaction('rw', db.files_meta, db.files_blob, db.files_thumb, async (tx) => {
    if (file.state === 'dirty' && file.version === 1) {
      tx.files_meta.delete(id)
    } else {
      await tx.files_meta.update(id, {
        deleted_at: Date.now(),
        state: 'dirty',
        version: file.state === 'dirty' ? file.version : file.version + 1,
      })
    }
    await tx.files_blob.delete(id)
    await tx.files_thumb.delete(id)
  })
}

export const fileOpened = async (id: string) => {
  const file = await db.files_meta.get(id)
  if (!file || file.deleted_at !== 0) return
  setState((state) => {
    state.files.openFile = {
      id,
      title: file.title,
      updated_at: file.updated_at,
      version: file.version,
    }
  })
}

export const fileClosed = () =>
  setState((state) => {
    state.files.openFile = null
  })
