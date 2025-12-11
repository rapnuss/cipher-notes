import {WritableDraft} from 'immer'
import {
  KeepNote,
  keepNoteSchema,
  notesZipSchema,
  ImportFileMeta,
  NotesZip,
  ImportProtectedNoteConfig,
} from '../business/importNotesSchema'
import {
  FileBlob,
  FileMeta,
  Hue,
  Label,
  Note,
  NoteCommon,
  protectedMessageSchema,
} from '../business/models'
import {db} from '../db'
import {downloadBlob, splitFilename} from '../util/misc'
import {getState, RootState, setState} from './store'
import JSZip from 'jszip'
import XSet from '../util/XSet'
import {createLabel} from './labels'
import {notifications} from '@mantine/notifications'
import {comlink} from '../comlink'
import {deriveKey, verifyPassword} from '../util/pbkdf2'
import {zodParseString} from '../util/zod'
import {decryptString, encryptString} from '../util/encryption'

export type ImportDialogState = {
  open: boolean
  file: File | null
  error: string | null
  oldPassword: string
  needsOldPassword: boolean
  loading: boolean
  parsedZip: JSZip | null
  parsedData: NotesZip | null
  importedProtectedConfig: ImportProtectedNoteConfig | null
}

export type ImportState = {
  importDialog: ImportDialogState
  keepImportDialog: {
    open: boolean
    file: File | null
    error: string | null
    importArchived: boolean
  }
}

const importDialogInit: ImportDialogState = {
  open: false,
  file: null,
  error: null,
  oldPassword: '',
  needsOldPassword: false,
  loading: false,
  parsedZip: null,
  parsedData: null,
  importedProtectedConfig: null,
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
    state.import.importDialog = importDialogInit
  } else {
    setState((state) => {
      state.import.importDialog = importDialogInit
    })
  }
}
export const importFileChanged = (file: File | null) =>
  setState((state) => {
    state.import.importDialog.file = file
    state.import.importDialog.error = null
    state.import.importDialog.needsOldPassword = false
    state.import.importDialog.parsedZip = null
    state.import.importDialog.parsedData = null
    state.import.importDialog.importedProtectedConfig = null
  })
export const setImportOldPassword = (password: string) =>
  setState((state) => {
    state.import.importDialog.oldPassword = password
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

  const [notes, filesMeta, filesBlobs] = await Promise.all([
    db.notes.toArray(),
    db.files_meta.toArray(),
    db.files_blob.toArray(),
  ])

  const protectedNotesConfig = getState().protectedNotes.config

  // map label ids to names for export
  const labelsCache = getState().labels.labelsCache
  const mapLabelIdsToNames = (ids?: string[]) =>
    ids?.map((id) => labelsCache[id]?.name).filter((v): v is string => !!v)

  const labelColors = Object.values(labelsCache ?? {}).reduce((acc, label) => {
    acc[label.name] = label.hue
    return acc
  }, {} as Record<string, Hue>)

  const idToBlob = Object.fromEntries(filesBlobs.map((b) => [b.id, b.blob]))

  const payload: NotesZip = {
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      txt: n.type === 'note' ? n.txt : undefined,
      todos: n.type === 'todo' ? n.todos : undefined,
      created_at: n.created_at,
      updated_at: n.updated_at,
      archived: n.archived === 1,
      labels: mapLabelIdsToNames(n.labels),
      cipher_text:
        n.type === 'note_protected' || n.type === 'todo_protected' ? n.cipher_text : undefined,
      iv: n.type === 'note_protected' || n.type === 'todo_protected' ? n.iv : undefined,
    })),
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
    protected_notes_config: protectedNotesConfig ?? undefined,
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

const hasProtectedNotes = (parsed: NotesZip) =>
  parsed.notes.some((n) => n.cipher_text !== undefined && n.iv !== undefined)

const configsMatch = (
  a: ImportProtectedNoteConfig | null | undefined,
  b: ImportProtectedNoteConfig | null | undefined
) => a?.master_salt === b?.master_salt && a?.verifier === b?.verifier

export const importNotes = async (): Promise<void> => {
  const state = getState()
  const {
    file,
    oldPassword,
    parsedZip: cachedZip,
    parsedData: cachedParsed,
  } = state.import.importDialog
  const currentConfig = state.protectedNotes.config
  const currentKey = state.protectedNotes.derivedKey
  if (!file) return

  setState((s) => {
    s.import.importDialog.loading = true
    s.import.importDialog.error = null
  })

  try {
    const zip = cachedZip ?? (await new JSZip().loadAsync(file))
    const notesJson = zip.file('notes.json')
    if (!notesJson) throw new Error('notes.json not found in archive')
    const parsed = cachedParsed ?? notesZipSchema.parse(JSON.parse(await notesJson.async('string')))

    const importedConfig = parsed.protected_notes_config ?? null
    const protectedNotesInImport = hasProtectedNotes(parsed)
    const configsDiffer = protectedNotesInImport && !configsMatch(importedConfig, currentConfig)

    if (configsDiffer && !oldPassword) {
      setState((s) => {
        s.import.importDialog.needsOldPassword = true
        s.import.importDialog.loading = false
        s.import.importDialog.parsedZip = zip
        s.import.importDialog.parsedData = parsed
        s.import.importDialog.importedProtectedConfig = importedConfig
      })
      return
    }

    let oldKey: CryptoKey | null = null
    let effectiveKey = currentKey
    let shouldAdoptImportedConfig = false
    let effectiveSalt = currentConfig?.master_salt

    if (configsDiffer && oldPassword && importedConfig) {
      oldKey = await deriveKey(oldPassword, importedConfig.master_salt)
      const valid = await verifyPassword(
        oldKey,
        importedConfig.verifier,
        importedConfig.verifier_iv
      )
      if (!valid) {
        setState((s) => {
          s.import.importDialog.error = 'Invalid password for imported notes'
          s.import.importDialog.loading = false
        })
        return
      }

      if (!currentConfig) {
        effectiveKey = oldKey
        shouldAdoptImportedConfig = true
        effectiveSalt = importedConfig.master_salt
      }
    }

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
        !existing ||
        existing.deleted_at !== 0 ||
        (importedNote.updated_at ?? 0) > existing.updated_at
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

      const todos = importedNote.todos
      const txt = importedNote.txt
      const cipher_text = importedNote.cipher_text
      const iv = importedNote.iv

      if (cipher_text !== undefined && iv !== undefined && effectiveSalt) {
        if (oldKey && effectiveKey) {
          const messageJson = await decryptString(oldKey, cipher_text, iv)
          const message = zodParseString(protectedMessageSchema, messageJson)
          if (!message) {
            console.error('Invalid note', messageJson)
            continue
          }
          const type = 'todos' in message ? 'todo_protected' : 'note_protected'
          const {cipher_text: new_cipher_text, iv: new_iv} = await encryptString(
            effectiveKey,
            messageJson
          )
          notesToUpsert.push({
            type,
            cipher_text: new_cipher_text,
            iv: new_iv,
            id,
            created_at,
            updated_at: now,
            version,
            state: 'dirty',
            deleted_at: 0,
            archived: importedNote.archived ? 1 : 0,
            labels,
            salt: effectiveSalt,
          })
        } else {
          throw new Error('missing key')
        }
      } else if (todos !== undefined) {
        const todoIds = XSet.fromItr(todos, (t) => t.id)
        notesToUpsert.push({
          id,
          title: importedNote.title ?? '',
          type: 'todo',
          todos: todos?.map((t) => ({
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
        })
      } else if (txt !== undefined) {
        notesToUpsert.push({
          id,
          title: importedNote.title ?? '',
          type: 'note',
          txt: txt,
          created_at,
          updated_at,
          version,
          state: 'dirty',
          deleted_at: 0,
          archived: importedNote.archived ? 1 : 0,
          labels,
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
      if (shouldAdoptImportedConfig && importedConfig && effectiveKey) {
        state.protectedNotes.config = {
          master_salt: importedConfig.master_salt,
          verifier: importedConfig.verifier,
          verifier_iv: importedConfig.verifier_iv,
          updated_at: Date.now(),
          state: 'dirty',
        }
        state.protectedNotes.derivedKey = effectiveKey
      }
    })
    notifications.show({title: 'Success', message: 'Backup imported'})
  } catch (e) {
    console.error(e)
    setState((state) => {
      state.import.importDialog.error = e instanceof Error ? e.message : 'Invalid file format'
      state.import.importDialog.loading = false
    })
  }
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
        deleted_at: 0,
        state: 'dirty',
        version: 1,
        labels: importNote.labels?.map((l) => nameToId[l.name]!),
        archived: importNote.isArchived ? 1 : 0,
      }
      const filesMeta: FileMeta[] =
        importNote.attachments?.map((a) => ({
          id: crypto.randomUUID(),
          created_at: noteCommon.created_at,
          updated_at: noteCommon.updated_at,
          title: importNote.title,
          deleted_at: noteCommon.deleted_at,
          state: noteCommon.state,
          version: noteCommon.version,
          labels: noteCommon.labels ?? [],
          archived: noteCommon.archived,

          type: 'file',
          ext: splitFilename(a.filePath)[1],
          mime: a.mimetype,
          has_thumb: 0,
          size: 0,
          blob_state: 'local',
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
          title: importNote.title,
          txt: importNote.textContent,
        }
        res.push(note)
      } else if ('listContent' in importNote) {
        const note: Note = {
          ...noteCommon,
          type: 'todo',
          title: importNote.title,
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
