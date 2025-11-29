import {WritableDraft} from 'immer'
import {
  KeepNote,
  keepNoteSchema,
  notesZipSchema,
  ImportFileMeta,
  NotesZip,
} from '../business/importNotesSchema'
import {FileBlob, FileMeta, Hue, Label, Note, NoteCommon} from '../business/models'
import {db} from '../db'
import {downloadBlob, splitFilename} from '../util/misc'
import {getState, RootState, setState} from './store'
import JSZip from 'jszip'
import XSet from '../util/XSet'
import {createLabel} from './labels'
import {notifications} from '@mantine/notifications'
import {comlink} from '../comlink'

export type ImportState = {
  importDialog: {
    open: boolean
    file: File | null
    error: string | null
    hasProtectedNotes: boolean
    protectedNotesPassword: string
    protectedNotesLoading: boolean
    protectedNotesError: string
    parsedZip: JSZip | null
    parsedData: NotesZip | null
  }
  keepImportDialog: {
    open: boolean
    file: File | null
    error: string | null
    importArchived: boolean
  }
}

const importDialogInit: ImportState['importDialog'] = {
  open: false,
  file: null,
  error: null,
  hasProtectedNotes: false,
  protectedNotesPassword: '',
  protectedNotesLoading: false,
  protectedNotesError: '',
  parsedZip: null,
  parsedData: null,
}

export const importInit: ImportState = {
  importDialog: importDialogInit,
  keepImportDialog: {open: false, file: null, error: null, importArchived: false},
}

// actions
export const openImportDialog = () =>
  setState((state) => {
    state.import.importDialog = {...importDialogInit, open: true}
  })
export const closeImportDialog = (state?: WritableDraft<RootState>) => {
  if (state) {
    state.import.importDialog = {...importDialogInit}
  } else {
    setState((state) => {
      state.import.importDialog = {...importDialogInit}
    })
  }
}
export const importFileChanged = (file: File | null) =>
  setState((state) => {
    state.import.importDialog.file = file
    state.import.importDialog.error = null
    state.import.importDialog.hasProtectedNotes = false
    state.import.importDialog.parsedZip = null
    state.import.importDialog.parsedData = null
  })
export const setProtectedNotesPassword = (password: string) =>
  setState((state) => {
    state.import.importDialog.protectedNotesPassword = password
    state.import.importDialog.protectedNotesError = ''
  })
export const openKeepImportDialog = () =>
  setState((state) => {
    state.import.keepImportDialog = {open: true, file: null, error: null, importArchived: false}
  })
export const closeKeepImportDialog = (state?: WritableDraft<RootState>) => {
  if (state) {
    state.import.keepImportDialog = importInit.keepImportDialog
  } else {
    setState((state) => {
      state.import.keepImportDialog = importInit.keepImportDialog
    })
  }
}
export const keepImportFileChanged = (file: File | null) =>
  setState((state) => {
    state.import.keepImportDialog.file = file
    state.import.keepImportDialog.error = null
  })
export const keepImportArchivedChanged = (importArchived: boolean) =>
  setState((state) => {
    state.import.keepImportDialog.importArchived = importArchived
  })

// effects
export const exportNotes = async () => {
  // Export all notes and files_meta into notes.json and add file blobs as separate files
  const zip = new JSZip()

  const [notes, filesMeta, filesBlobs, protectedNotesConfig] = await Promise.all([
    db.notes.toArray(),
    db.files_meta.toArray(),
    db.files_blob.toArray(),
    db.protected_notes_config.get('config'),
  ])

  // map label ids to names for export
  const labelsCache = getState().labels.labelsCache
  const mapLabelIdsToNames = (ids?: string[]) =>
    ids?.map((id) => labelsCache[id]?.name).filter((v): v is string => !!v)

  const labelColors = Object.values(labelsCache ?? {}).reduce((acc, label) => {
    acc[label.name] = label.hue
    return acc
  }, {} as Record<string, Hue>)

  const idToBlob = Object.fromEntries(filesBlobs.map((b) => [b.id, b.blob]))
  const hasProtectedNotes = notes.some((n) => n.protected === 1)

  const payload: NotesZip = {
    notes: notes.map((n) => {
      if (n.protected === 1 && n.protected_iv) {
        return {
          id: n.id,
          title: '',
          txt: n.type === 'note' ? n.txt : n.todos[0]?.id,
          created_at: n.created_at,
          updated_at: n.updated_at,
          archived: n.archived === 1,
          labels: mapLabelIdsToNames(n.labels),
          protected: true,
          protected_iv: n.protected_iv,
          protected_type: n.type,
        }
      }
      return {
        id: n.id,
        title: n.title,
        txt: n.type === 'note' ? n.txt : undefined,
        todos: n.type === 'todo' ? n.todos : undefined,
        created_at: n.created_at,
        updated_at: n.updated_at,
        archived: n.archived === 1,
        labels: mapLabelIdsToNames(n.labels),
      }
    }),
    files_meta: filesMeta.map(
      (f) =>
        ({
          id: f.id,
          title: f.title,
          ext: f.ext,
          mime: f.mime,
          size: f.size,
          created_at: f.created_at,
          updated_at: f.updated_at,
          deleted_at: f.deleted_at,
          archived: f.archived === 1,
          labels: mapLabelIdsToNames(f.labels),
        } satisfies ImportFileMeta)
    ),
    labelColors,
    protected_notes_salt:
      hasProtectedNotes && protectedNotesConfig ? protectedNotesConfig.master_salt : undefined,
  }

  // validate payload
  notesZipSchema.parse(payload)

  zip.file('notes.json', JSON.stringify(payload, null, 2), {createFolders: false})

  for (const meta of filesMeta) {
    const blob = idToBlob[meta.id]
    if (!blob) continue
    const filename = `${meta.id}${meta.ext ?? ''}`
    zip.file(filename, blob)
  }

  const iso = new Date().toISOString().replace(/\.\d+/, '').replace(/:/g, '-')
  const blob = await zip.generateAsync({type: 'blob'})
  downloadBlob(blob, `${iso}_ciphernotes.zip`)
}

export const importNotes = async (): Promise<void> => {
  const state = getState()
  const file = state.import.importDialog.file
  if (!file) return

  try {
    const zip = await new JSZip().loadAsync(file)
    const notesJson = zip.file('notes.json')
    if (!notesJson) throw new Error('notes.json not found in archive')
    const parsed = notesZipSchema.parse(JSON.parse(await notesJson.async('string')))

    const hasProtectedNotes = parsed.notes.some((n) => n.protected)

    if (hasProtectedNotes) {
      setState((state) => {
        state.import.importDialog.hasProtectedNotes = true
        state.import.importDialog.parsedZip = zip
        state.import.importDialog.parsedData = parsed
      })
      return
    }

    await doImportNotes(zip, parsed)
  } catch (e) {
    console.error(e)
    setState((state) => {
      state.import.importDialog.error = e instanceof Error ? e.message : 'Invalid file format'
    })
  }
}

export const importNotesWithPassword = async (): Promise<void> => {
  const state = getState()
  const {parsedZip, parsedData, protectedNotesPassword} = state.import.importDialog
  if (!parsedZip || !parsedData) return

  setState((s) => {
    s.import.importDialog.protectedNotesLoading = true
    s.import.importDialog.protectedNotesError = ''
  })

  try {
    const {deriveKey} = await import('../util/pbkdf2')
    const {decryptNotePlainData, encryptNoteForStorage} = await import(
      '../business/protectedNotesEncryption'
    )

    const protectedNotes = parsedData.notes.filter((n) => n.protected)
    if (protectedNotes.length === 0) {
      await doImportNotes(parsedZip, parsedData)
      return
    }

    const importSalt = parsedData.protected_notes_salt ?? ''
    const importKey = await deriveKey(protectedNotesPassword, importSalt)

    const firstProtected = protectedNotes[0]!
    try {
      await decryptNotePlainData(
        importKey,
        firstProtected.txt ?? '',
        firstProtected.protected_iv ?? ''
      )
    } catch {
      setState((s) => {
        s.import.importDialog.protectedNotesLoading = false
        s.import.importDialog.protectedNotesError = 'Incorrect password'
      })
      return
    }

    const currentConfig = await db.protected_notes_config.get('config')
    const currentKey = currentConfig
      ? await deriveKey(protectedNotesPassword, currentConfig.master_salt)
      : null

    const processedNotes = await Promise.all(
      parsedData.notes.map(async (n) => {
        if (!n.protected || !n.protected_iv || !n.txt) return n

        try {
          const plainData = await decryptNotePlainData(importKey, n.txt, n.protected_iv)
          if (currentKey) {
            const tempNote: Note =
              n.protected_type === 'todo'
                ? {
                    id: n.id ?? crypto.randomUUID(),
                    title: plainData.title,
                    type: 'todo',
                    todos: plainData.todos ?? [],
                    created_at: n.created_at ?? Date.now(),
                    updated_at: n.updated_at ?? Date.now(),
                    version: 1,
                    state: 'dirty',
                    deleted_at: 0,
                    archived: n.archived ? 1 : 0,
                    labels: n.labels,
                    protected: 1,
                  }
                : {
                    id: n.id ?? crypto.randomUUID(),
                    title: plainData.title,
                    type: 'note',
                    txt: plainData.txt ?? '',
                    created_at: n.created_at ?? Date.now(),
                    updated_at: n.updated_at ?? Date.now(),
                    version: 1,
                    state: 'dirty',
                    deleted_at: 0,
                    archived: n.archived ? 1 : 0,
                    labels: n.labels,
                    protected: 1,
                  }
            const encrypted = await encryptNoteForStorage(tempNote, currentKey)
            return {
              ...n,
              title: '',
              txt: encrypted.type === 'note' ? encrypted.txt : encrypted.todos[0]?.id,
              todos: undefined,
              protected: true,
              protected_iv: encrypted.protected_iv,
              protected_type: n.protected_type,
            }
          } else {
            return {
              ...n,
              title: plainData.title,
              txt: n.protected_type === 'note' ? plainData.txt : undefined,
              todos: n.protected_type === 'todo' ? plainData.todos : undefined,
              protected: false,
              protected_iv: undefined,
              protected_type: undefined,
            }
          }
        } catch (e) {
          console.error('Failed to decrypt note during import:', e)
          return n
        }
      })
    )

    await doImportNotes(parsedZip, {...parsedData, notes: processedNotes})
  } catch (e) {
    console.error(e)
    setState((s) => {
      s.import.importDialog.protectedNotesLoading = false
      s.import.importDialog.protectedNotesError =
        e instanceof Error ? e.message : 'Failed to import'
    })
  }
}

const doImportNotes = async (zip: JSZip, parsed: NotesZip): Promise<void> => {
  const now = Date.now()
  const {labelsCache} = getState().labels
  const cachedLabels = Object.values(labelsCache)
  const existingLabels = XSet.fromItr(cachedLabels, (l) => l.name)
  const importLabelNames = XSet.fromItr([
    ...parsed.notes.flatMap((n) => n.labels ?? []),
    ...parsed.files_meta.flatMap((f) => f.labels ?? []),
  ])
  const newLabelNames = importLabelNames.without(existingLabels).toArray()
  const createdLabels: Label[] = []
  for (const name of newLabelNames) {
    createdLabels.push(await createLabel(name, parsed.labelColors?.[name] ?? null))
  }
  const nameToId = Object.fromEntries(
    [...cachedLabels, ...createdLabels].map((l) => [l.name, l.id])
  )

  const notesToUpsert: Note[] = []
  for (const importedNote of parsed.notes ?? []) {
    const id = importedNote.id ?? crypto.randomUUID()
    const existing = await db.notes.get(id)
    const shouldInsertOrUpdate =
      !existing || existing.deleted_at !== 0 || (importedNote.updated_at ?? 0) > existing.updated_at
    if (!shouldInsertOrUpdate) continue

    const updated_at = Math.max(importedNote.updated_at ?? 0, existing?.updated_at ?? 0)
    const created_at = existing?.created_at ?? importedNote.created_at ?? now
    const version = !existing
      ? 1
      : existing.state === 'dirty'
      ? existing.version
      : existing.version + 1

    const labels = (importedNote.labels ?? [])
      .map((name) => nameToId[name])
      .filter((x): x is string => !!x)

    if (importedNote.protected && importedNote.protected_iv && importedNote.txt) {
      const noteType = importedNote.protected_type ?? 'note'
      if (noteType === 'todo') {
        notesToUpsert.push({
          id,
          title: '',
          type: 'todo',
          todos: [{id: importedNote.txt, done: false, txt: ''}],
          created_at,
          updated_at,
          version,
          state: 'dirty',
          deleted_at: 0,
          archived: importedNote.archived ? 1 : 0,
          labels,
          protected: 1,
          protected_iv: importedNote.protected_iv,
        })
      } else {
        notesToUpsert.push({
          id,
          title: '',
          type: 'note',
          txt: importedNote.txt,
          created_at,
          updated_at,
          version,
          state: 'dirty',
          deleted_at: 0,
          archived: importedNote.archived ? 1 : 0,
          labels,
          protected: 1,
          protected_iv: importedNote.protected_iv,
        })
      }
    } else if (importedNote.todos !== undefined) {
      const todoIds = XSet.fromItr(importedNote.todos, (t) => t.id)
      notesToUpsert.push({
        id,
        title: importedNote.title ?? '',
        type: 'todo',
        todos: importedNote.todos.map((t) => ({
          ...t,
          id: t.id ?? crypto.randomUUID(),
          updated_at: t.updated_at ?? updated_at,
          parent: todoIds.has(t.parent) ? t.parent : undefined,
        })),
        created_at,
        updated_at,
        version,
        state: 'dirty',
        deleted_at: 0,
        archived: importedNote.archived ? 1 : 0,
        labels,
        protected: 0,
      })
    } else if (importedNote.txt !== undefined) {
      notesToUpsert.push({
        id,
        title: importedNote.title ?? '',
        type: 'note',
        txt: importedNote.txt,
        created_at,
        updated_at,
        version,
        state: 'dirty',
        deleted_at: 0,
        archived: importedNote.archived ? 1 : 0,
        labels,
        protected: 0,
      })
    }
  }

  const filesMetaToUpsert: FileMeta[] = []
  const blobsToPut: {id: string; blob: Blob}[] = []
  for (const meta of parsed.files_meta ?? []) {
    const existing = await db.files_meta.get(meta.id)
    const shouldInsertOrUpdate =
      !existing || existing.deleted_at !== 0 || (meta.updated_at ?? 0) > existing.updated_at
    if (!shouldInsertOrUpdate) continue

    const version = !existing
      ? 1
      : existing.state === 'dirty'
      ? existing.version
      : existing.version + 1

    const entry = zip.file(`${meta.id}${meta.ext ?? ''}`)
    const blob = entry ? await entry!.async('blob') : null
    if (blob) {
      blobsToPut.push({id: meta.id, blob: new Blob([blob], {type: meta.mime})})
    } else {
      continue
    }

    filesMetaToUpsert.push({
      id: meta.id,
      type: 'file',
      title: meta.title,
      ext: meta.ext,
      mime: meta.mime,
      size: blob.size,
      created_at: meta.created_at ?? now,
      updated_at: meta.updated_at ?? now,
      deleted_at: meta.deleted_at ?? 0,
      labels: (meta.labels ?? []).map((name) => nameToId[name]).filter((x): x is string => !!x),
      archived: meta.archived ? 1 : 0,
      has_thumb: 0,
      state: 'dirty',
      version,
      blob_state: 'local',
      protected: 0,
    })
  }

  await db.transaction('rw', db.notes, db.files_meta, db.files_blob, async (tx) => {
    if (notesToUpsert.length) await tx.notes.bulkPut(notesToUpsert)
    if (filesMetaToUpsert.length) await tx.files_meta.bulkPut(filesMetaToUpsert)
    if (blobsToPut.length) await tx.files_blob.bulkPut(blobsToPut)
  })

  comlink
    .generateThumbnails()
    .then(() => console.log('thumbnails generated'))
    .catch(console.error)

  setState((state) => {
    closeImportDialog(state)
  })
  notifications.show({title: 'Success', message: 'Backup imported'})
}

export const keepImportNotes = async (): Promise<void> => {
  const state = getState()
  const {file, importArchived} = state.import.keepImportDialog
  const {labelsCache} = state.labels
  const cachedLabels = Object.values(labelsCache)
  const existingLabels = XSet.fromItr(cachedLabels, (l) => l.name)
  if (!file) {
    return
  }
  try {
    const zip = new JSZip()
    const zipFile = await zip.loadAsync(file)
    const res: Note[] = []
    const resFiles: FileMeta[] = []
    const resBlobs: FileBlob[] = []
    const re = /Keep\/[^/]+\.json$/

    const importNotes: KeepNote[] = []
    for (const [path, file] of Object.entries(zipFile.files)) {
      if (!re.test(path)) {
        continue
      }
      try {
        const importNote = keepNoteSchema.parse(JSON.parse(await file.async('string')))
        if (!importNote.isTrashed && (!importNote.isArchived || importArchived)) {
          importNotes.push(importNote)
        }
      } catch (e) {
        console.error('Error parsing keep note', e)
        continue
      }
    }

    const importLabels = XSet.fromItr(
      importNotes.flatMap((n) => n.labels ?? []),
      (l) => l.name
    )
    const newLabels = importLabels.without(existingLabels).toArray()
    const createdLabels: Label[] = []
    for (const name of newLabels) {
      createdLabels.push(await createLabel(name))
    }
    const nameToId = Object.fromEntries(
      [...cachedLabels, ...createdLabels].map((l) => [l.name, l.id])
    )

    for (const importNote of importNotes) {
      const noteCommon: NoteCommon = {
        id: crypto.randomUUID(),
        created_at: importNote.createdTimestampUsec / 1000,
        updated_at: importNote.userEditedTimestampUsec / 1000,
        title: importNote.title,
        deleted_at: 0,
        state: 'dirty',
        version: 1,
        labels: importNote.labels?.map((l) => nameToId[l.name]!),
        archived: importNote.isArchived ? 1 : 0,
        protected: 0,
      }
      const filesMeta: FileMeta[] =
        importNote.attachments?.map((a) => ({
          id: crypto.randomUUID(),
          created_at: noteCommon.created_at,
          updated_at: noteCommon.updated_at,
          title: noteCommon.title,
          deleted_at: noteCommon.deleted_at,
          state: noteCommon.state,
          version: noteCommon.version,
          labels: noteCommon.labels ?? [],
          archived: noteCommon.archived,
          protected: 0 as const,

          type: 'file' as const,
          ext: splitFilename(a.filePath)[1],
          mime: a.mimetype,
          has_thumb: 0 as const,
          size: 0,
          blob_state: 'local' as const,
        })) ?? []
      for (let i = filesMeta.length - 1; i >= 0; --i) {
        const fileMeta = filesMeta[i]!
        const a = importNote.attachments![i]!
        const blob = await zipFile.file(`Takeout/Keep/${a.filePath}`)?.async('blob')
        if (blob) {
          const blobWithType = new Blob([blob], {type: a.mimetype})
          resBlobs.push({id: fileMeta.id, blob: blobWithType})
          filesMeta[i]!.size = blob.size
        } else {
          filesMeta.splice(i, 1)
          console.warn(`File ${a.filePath} not found in zip`)
        }
      }
      resFiles.push(...filesMeta)
      if ('textContent' in importNote) {
        const note: Note = {
          ...noteCommon,
          type: 'note',
          txt: importNote.textContent,
        }
        res.push(note)
      } else if ('listContent' in importNote) {
        const note: Note = {
          ...noteCommon,
          type: 'todo',
          todos: importNote.listContent.map((item) => ({
            id: crypto.randomUUID(),
            txt: item.text,
            done: item.isChecked,
            updated_at: importNote.userEditedTimestampUsec / 1000,
          })),
        }
        res.push(note)
      }
    }
    if (res.length === 0) {
      notifications.show({title: 'No notes imported', message: 'No valid notes found'})
      return
    }
    await db.notes.bulkPut(res)
    await db.files_meta.bulkPut(resFiles)
    await db.files_blob.bulkPut(resBlobs)
    comlink
      .generateThumbnails()
      .then(() => console.log('thumbnails generated'))
      .catch(console.error)
    closeKeepImportDialog()
    notifications.show({title: 'Success', message: 'Keep notes imported'})
  } catch (e) {
    console.error(e)
    setState((state) => {
      state.import.keepImportDialog.error = e instanceof Error ? e.message : 'Unknown error'
    })
  }
}
