import {ActiveLabel, activeLabelIsUuid, FileBlob, FileMeta} from '../business/models'
import {comlink} from '../comlink'
import {db} from '../db'
import {debounce, nonConcurrent, splitFilename} from '../util/misc'
import {getState, setState, subscribe} from './store'

export type FilesState = {
  importing: boolean
  openFile: {
    id: string
    title: string
    updated_at: number
    version: number
    state: 'dirty' | 'synced'
    archived: 0 | 1
  } | null
  fileDialog: {
    labelDropdownOpen: boolean
    moreMenuOpen: boolean
  }
}
export const filesInit = {
  importing: false,
  openFile: null,
  fileDialog: {
    labelDropdownOpen: false,
    moreMenuOpen: false,
  },
}

export const setLabelDropdownOpen = (open: boolean) =>
  setState((state) => {
    state.files.fileDialog.labelDropdownOpen = open
  })

export const setMoreMenuOpen = (open: boolean) =>
  setState((state) => {
    state.files.fileDialog.moreMenuOpen = open
  })

export const openFileArchivedToggled = () =>
  setState((state) => {
    if (!state.files.openFile) return
    state.files.openFile.archived = state.files.openFile.archived ? 0 : 1
    state.files.openFile.updated_at = Date.now()
  })

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

export const setOpenFileArchived = (archived: boolean) =>
  setState((state) => {
    const {openFile} = state.files
    if (!openFile) {
      return
    }
    openFile.archived = archived ? 1 : 0
    openFile.updated_at = Date.now()
    if (openFile.state === 'synced') {
      openFile.state = 'dirty'
      openFile.version++
    }
  })

export const deleteOpenFile = async () => {
  const openFile = getState().files.openFile
  if (!openFile) return
  setState((state) => {
    state.files.openFile = null
  })
  await deleteFile(openFile.id)
}

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
      state: file.state,
      archived: file.archived,
    }
  })
}

export const fileClosed = async () => {
  const openFile = getState().files.openFile
  if (!openFile) return

  await storeOpenFile()

  setState((state) => {
    state.files.openFile = null
    state.files.fileDialog = {
      labelDropdownOpen: false,
      moreMenuOpen: false,
    }
  })
}

export const openFileTitleChanged = (value: string) =>
  setState((state) => {
    if (!state.files.openFile) {
      return
    }
    const openFile = state.files.openFile
    openFile.title = value
    openFile.updated_at = Date.now()
    if (openFile.state === 'synced') {
      openFile.version++
      openFile.state = 'dirty'
    }
  })

export const importFiles = async (files: FileList, activeLabel: ActiveLabel) => {
  try {
    setFilesImporting(true)
    for (const file of files) {
      const [name, ext] = splitFilename(file.name)
      const id = crypto.randomUUID()
      const now = Date.now()
      const meta: FileMeta = {
        type: 'file',
        created_at: now,
        updated_at: now,
        deleted_at: 0,
        ext,
        id,
        title: name,
        state: 'dirty',
        version: 1,
        blobState: 'local',
        mime: file.type,
        labels: activeLabelIsUuid(activeLabel) ? [activeLabel] : [],
        archived: 0,
        has_thumb: 0,
      }
      const blob: FileBlob = {
        id,
        blob: file,
      }
      await db.transaction('rw', db.files_meta, db.files_blob, async (tx) => {
        await tx.files_meta.add(meta)
        await tx.files_blob.add(blob)
      })
    }
    await comlink.generateThumbnails().catch(console.error)
  } finally {
    setFilesImporting(false)
  }
}

const storeOpenFile = nonConcurrent(async () => {
  const openFile = getState().files.openFile
  if (!openFile) return

  const file = await db.files_meta.get(openFile.id)
  if (!file || file.deleted_at !== 0) return

  if (file.title !== openFile.title || file.archived !== openFile.archived) {
    await db.files_meta.update(openFile.id, {
      title: openFile.title,
      archived: openFile.archived ? 1 : 0,
      updated_at: openFile.updated_at,
      state: openFile.state,
      version: openFile.version,
    })
  }
})

export const registerFilesSubscriptions = () => {
  const storeDebounced = debounce(storeOpenFile, 1000)
  subscribe(
    (state) => state.files.openFile,
    (curr, prev) => curr && prev && storeDebounced()
  )
}
