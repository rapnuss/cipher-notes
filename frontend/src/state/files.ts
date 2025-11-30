import {notifications} from '@mantine/notifications'
import {
  ActiveLabel,
  activeLabelIsUuid,
  FileBlob,
  FileMeta,
  FilePullWithState,
} from '../business/models'
import {comlink} from '../comlink'
import {db, hasUnsyncedBlobsObservable} from '../db'
import {loadOpenFileId, storeOpenFileId} from '../services/localStorage'
import {debounce, nonConcurrent, splitFilename} from '../util/misc'
import {getState, setState, subscribe} from './store'
import {decryptFileTitle, encryptFileTitle} from '../business/protectedNotesEncryption'
import {getProtectedNotesKey} from './protectedNotes'
import {decryptBlob, encryptBlob} from '../util/encryption'
import {convertImageToPng} from '../util/convertImageToPng'

export type ProtectFilesDialog = {
  open: boolean
  files: File[]
  activeLabel: ActiveLabel
}

export type FilesState = {
  importing: boolean
  upDownloading: boolean
  openFile: {
    id: string
    title: string
    updated_at: number
    version: number
    state: 'dirty' | 'synced'
    archived: 0 | 1
    protected: 0 | 1
  } | null
  fileDialog: {
    labelDropdownOpen: boolean
    moreMenuOpen: boolean
  }
  protectFilesDialog: ProtectFilesDialog
}
export const filesInit: FilesState = {
  importing: false,
  upDownloading: false,
  openFile: null,
  fileDialog: {
    labelDropdownOpen: false,
    moreMenuOpen: false,
  },
  protectFilesDialog: {
    open: false,
    files: [],
    activeLabel: 'all',
  },
}
loadOpenFileId().then((id) => {
  if (id) {
    fileOpened(id)
  }
})

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
    if (state.files.openFile.state === 'synced') {
      state.files.openFile.version++
      state.files.openFile.state = 'dirty'
    }
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
        file.state = 'dirty'
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
      const now = Date.now()
      await tx.files_meta.update(id, {
        deleted_at: now,
        updated_at: now,
        state: 'dirty',
        version: file.state === 'dirty' ? file.version : file.version + 1,
        title: '',
        labels: [],
      })
    }
    // > "Promise that resolves successfully with an undefined result, no matter if a record was deleted or not."
    await tx.files_blob.delete(id)
    await tx.files_thumb.delete(id)
  })
}

export const fileOpened = async (id: string) => {
  const file = await db.files_meta.get(id)
  if (!file || file.deleted_at !== 0) return
  let title = file.title
  if (file.protected === 1) {
    const key = getProtectedNotesKey()
    if (!key || !file.protected_iv) return
    try {
      title = await decryptFileTitle(key, file.title, file.protected_iv)
    } catch {
      return
    }
  }
  setState((state) => {
    state.files.openFile = {
      id,
      title,
      updated_at: file.updated_at,
      version: file.version,
      state: file.state,
      archived: file.archived,
      protected: file.protected,
    }
  })
  const state = getState()
  if (
    state.user.connected &&
    state.user.user.keyTokenPair &&
    file.blob_state === 'remote' &&
    !state.files.upDownloading
  ) {
    upDownloadBlobsAndSetState()
  }
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

export const setOpenFile = async (syncedFiles: Record<string, FilePullWithState>) => {
  const openFile = getState().files.openFile
  if (!openFile) {
    return
  }
  const file = syncedFiles[openFile.id]
  if (!file) {
    return
  }
  if (file.deleted_at !== 0 || file.title === undefined) {
    return setState((state) => {
      state.files.openFile = null
    })
  }
  let title = file.title
  if (file.protected === 1) {
    const key = getProtectedNotesKey()
    if (!key || !file.protected_iv) return
    try {
      title = await decryptFileTitle(key, file.title, file.protected_iv)
    } catch {
      return
    }
  }
  if (
    file.version > openFile.version ||
    (file.version === openFile.version && file.updated_at >= openFile.updated_at)
  ) {
    setState((state) => {
      state.files.openFile = {
        id: file.id,
        title,
        updated_at: file.updated_at,
        version: file.version,
        state: file.state,
        archived: file.archived,
        protected: file.protected,
      }
    })
  }
}

export const onFilesSelected = (files: File[], activeLabel: ActiveLabel) => {
  const {unlocked} = getState().protectedNotes
  if (unlocked) {
    setState((state) => {
      state.files.protectFilesDialog = {
        open: true,
        files,
        activeLabel,
      }
    })
  } else {
    importFiles(files, activeLabel, false)
  }
}

export const closeProtectFilesDialog = () =>
  setState((state) => {
    state.files.protectFilesDialog = {
      open: false,
      files: [],
      activeLabel: 'all',
    }
  })

export const confirmProtectFilesDialog = (protect: boolean) => {
  const {files, activeLabel} = getState().files.protectFilesDialog
  closeProtectFilesDialog()
  importFiles(files, activeLabel, protect)
}

export const importFiles = async (
  files: Iterable<File>,
  activeLabel: ActiveLabel,
  protect: boolean
) => {
  try {
    setFilesImporting(true)
    const key = protect ? getProtectedNotesKey() : null
    for (const file of files) {
      const [name, ext] = splitFilename(file.name)
      const id = crypto.randomUUID()
      const now = Date.now()

      let title = name
      let protectedIv: string | undefined
      if (protect && key) {
        const encrypted = await encryptFileTitle(key, name)
        title = encrypted.encrypted
        protectedIv = encrypted.iv
      }

      const meta: FileMeta = {
        type: 'file',
        created_at: now,
        updated_at: now,
        deleted_at: 0,
        ext,
        id,
        title,
        state: 'dirty',
        version: 1,
        blob_state: 'local',
        mime: file.type,
        labels: activeLabelIsUuid(activeLabel) ? [activeLabel] : [],
        archived: 0,
        has_thumb: 0,
        size: file.size,
        protected: protect && key ? 1 : 0,
        protected_iv: protectedIv,
      }
      const blob: FileBlob = {
        id,
        blob: protect && key ? await encryptBlob(key, file) : file,
      }
      await db.transaction('rw', db.files_meta, db.files_blob, async (tx) => {
        await tx.files_meta.add(meta)
        await tx.files_blob.add(blob)
      })
    }
    if (!protect) {
      comlink
        .generateThumbnails()
        .then(() => console.log('thumbnails generated'))
        .catch(console.error)
    }
  } finally {
    setFilesImporting(false)
  }
}

const storeOpenFile = nonConcurrent(async () => {
  const openFile = getState().files.openFile
  if (!openFile) return

  const file = await db.files_meta.get(openFile.id)
  if (!file || file.deleted_at !== 0) return

  let titleChanged = file.title !== openFile.title
  if (file.protected === 1 && file.protected_iv) {
    const key = getProtectedNotesKey()
    if (key) {
      try {
        const decryptedTitle = await decryptFileTitle(key, file.title, file.protected_iv)
        titleChanged = decryptedTitle !== openFile.title
      } catch {
        titleChanged = true
      }
    } else {
      titleChanged = true
    }
  }

  if (titleChanged || file.archived !== openFile.archived) {
    const updates: Partial<FileMeta> = {
      archived: openFile.archived,
      updated_at: openFile.updated_at,
      state: openFile.state,
      version: openFile.version,
    }
    if (file.protected === 1) {
      const key = getProtectedNotesKey()
      if (!key) {
        console.error('Cannot store protected file title: no key available')
        return
      }
      const encrypted = await encryptFileTitle(key, openFile.title)
      updates.title = encrypted.encrypted
      updates.protected_iv = encrypted.iv
    } else {
      updates.title = openFile.title
      updates.protected_iv = undefined
    }
    await db.files_meta.update(openFile.id, updates)
  }
})

export const isClipboardSupported = (mime: string) => {
  if (!navigator.clipboard || !('write' in navigator.clipboard)) return false
  return mime.startsWith('image/') || mime.startsWith('text/') || mime === 'application/json'
}

export const copyFileToClipboard = async (file: FileMeta) => {
  try {
    const blob = await getDecryptedFileBlob(file)
    if (!blob) throw new Error('File not available locally')

    if (file.mime.startsWith('text/') || file.mime === 'application/json') {
      const textBlob =
        file.mime === 'application/json'
          ? new Blob([await blob.text()], {type: 'text/plain'})
          : blob
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': textBlob,
        }),
      ])
      notifications.show({message: 'Text content copied to clipboard.'})
      return
    }

    if (file.mime.startsWith('image/')) {
      const imageBlob = file.mime === 'image/png' ? blob : await convertImageToPng(blob, file.mime)
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': imageBlob,
        }),
      ])
      notifications.show({message: 'Image copied to clipboard.'})
      return
    }

    throw new Error('unsupported file type')
  } catch (e) {
    notifications.show({
      color: 'red',
      message: `Could not copy to clipboard: ${e instanceof Error ? e.message : 'Unknown error'}`,
    })
  }
}

const upDownloadBlobsAndSetState = nonConcurrent(async () => {
  const keyTokenPair = getState().user.user.keyTokenPair
  if (!keyTokenPair) {
    return
  }
  setState((state) => {
    state.files.upDownloading = true
  })
  await comlink
    .upDownloadBlobs(keyTokenPair.cryptoKey)
    .then(({hit_storage_limit}) => {
      if (hit_storage_limit) {
        const state = getState()
        if (state.notes.sync.dialogOpen) {
          notifications.show({
            title: 'File storage limit reached',
            message: 'You have reached your file storage limit!',
            color: 'red',
          })
        }
      }
    })
    .catch((error) => {
      console.error(error)
      const state = getState()
      if (state.notes.sync.dialogOpen) {
        notifications.show({
          title: 'Failed to sync files',
          message: error?.message ?? 'Unknown error',
          color: 'red',
        })
      }
      setState((state) => {
        state.notes.sync.error = error?.message ?? 'Unknown error'
      })
    })
    .finally(() => {
      setState((state) => {
        state.files.upDownloading = false
      })
    })
})
export const upDownloadBlobsAndSetStateDebounced = debounce(upDownloadBlobsAndSetState, 1000)

export const registerFilesSubscriptions = () => {
  const storeDebounced = debounce(storeOpenFile, 1000)
  subscribe(
    (state) => state.files.openFile,
    (curr, prev) => curr && prev && storeDebounced()
  )

  subscribe(
    (state) => (state.files.openFile?.protected ? null : state.files.openFile?.id ?? null),
    storeOpenFileId
  )

  hasUnsyncedBlobsObservable.subscribe((hasUnsyncedBlobs) => {
    if (hasUnsyncedBlobs) {
      upDownloadBlobsAndSetStateDebounced()
    }
  })
}

export const getDecryptedFileBlob = async (file: FileMeta): Promise<Blob | null> => {
  if (file.blob_state === 'remote') return null
  const blobRecord = await db.files_blob.get(file.id)
  if (!blobRecord?.blob) return null
  if (file.protected !== 1) return blobRecord.blob
  const key = getProtectedNotesKey()
  if (!key) return null
  return await decryptBlob(key, blobRecord.blob, file.mime)
}
