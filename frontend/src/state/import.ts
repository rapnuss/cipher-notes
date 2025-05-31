import {WritableDraft} from 'immer'
import {
  ImportNote,
  importNotesSchema,
  KeepNote,
  keepNoteSchema,
} from '../business/importNotesSchema'
import {Label, Note, NoteCommon} from '../business/models'
import {db} from '../db'
import {downloadJson} from '../util/misc'
import {getState, RootState, setState} from './store'
import JSZip from 'jszip'
import XSet from '../util/XSet'
import {createLabel} from './labels'
import {notifications} from '@mantine/notifications'

export type ImportState = {
  importDialog: {
    open: boolean
    file: File | null
    error: string | null
  }
  keepImportDialog: {
    open: boolean
    file: File | null
    error: string | null
    importArchived: boolean
  }
}

export const importInit: ImportState = {
  importDialog: {open: false, file: null, error: null},
  keepImportDialog: {open: false, file: null, error: null, importArchived: false},
}

// actions
export const openImportDialog = () =>
  setState((state) => {
    state.import.importDialog = {open: true, file: null, error: null}
  })
export const closeImportDialog = (state?: WritableDraft<RootState>) => {
  if (state) {
    state.import.importDialog = importInit.importDialog
  } else {
    setState((state) => {
      state.import.importDialog = importInit.importDialog
    })
  }
}
export const importFileChanged = (file: File | null) =>
  setState((state) => {
    state.import.importDialog.file = file
    state.import.importDialog.error = null
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
  const {labelsCache} = getState().labels
  const notes = await db.notes.where('deleted_at').equals(0).toArray()
  const notesToExport: ImportNote[] = notes.map((n) => ({
    id: n.id,
    txt: n.txt,
    title: n.title,
    created_at: n.created_at,
    updated_at: n.updated_at,
    todos: n.todos,
    labels: n.labels?.map((l) => labelsCache[l]?.name).filter((l) => l !== undefined),
    archived: n.archived === 1,
  }))
  downloadJson(notesToExport, 'notes.json')
}
export const importNotes = async (): Promise<void> => {
  const state = getState()
  const {labelsCache} = state.labels
  const cachedLabels = Object.values(labelsCache)
  const existingLabels = XSet.fromItr(cachedLabels, (l) => l.name)
  const file = state.import.importDialog.file
  if (!file) {
    return
  }
  try {
    const importNotes = importNotesSchema.parse(JSON.parse(await file.text()))
    const res: Note[] = []
    const now = Date.now()
    const importLabels = XSet.fromItr(importNotes.flatMap((n) => n.labels ?? []))
    const newLabels = importLabels.without(existingLabels).toArray()
    const createdLabels: Label[] = []
    for (const name of newLabels) {
      createdLabels.push(await createLabel(name))
    }
    const nameToId = Object.fromEntries(
      [...cachedLabels, ...createdLabels].map((l) => [l.name, l.id])
    )
    for (const importNote of importNotes) {
      let {id, updated_at = now} = importNote
      if (id === undefined) {
        id = crypto.randomUUID()
      }
      const {txt, todos, title, labels, archived} = importNote
      if (todos === undefined && txt === undefined) {
        continue
      }
      const todoIds = XSet.fromItr(todos ?? [], (t) => t.id)
      const type = todos ? 'todo' : 'note'
      const existingNote = await db.notes.get(id)
      if (!existingNote || existingNote.deleted_at !== 0 || updated_at > existingNote.updated_at) {
        updated_at = Math.max(updated_at, existingNote?.updated_at ?? 0)
        const indeterminate = {
          id,
          created_at: existingNote?.created_at ?? now,
          updated_at,
          txt,
          state: 'dirty',
          type,
          title: title ?? '',
          version: !existingNote
            ? 1
            : existingNote.state === 'dirty'
            ? existingNote.version
            : existingNote.version + 1,
          deleted_at: 0,
          archived: archived ? 1 : 0,
          todos: todos?.map((t) => ({
            ...t,
            id: t.id ?? crypto.randomUUID(),
            updated_at: t.updated_at ?? updated_at,
            parent: todoIds.has(t.parent) ? t.parent : undefined,
          })),
          labels: XSet.fromItr(existingNote?.labels ?? [])
            .addItr(labels ?? [], (l) => nameToId[l]!)
            .toArray(),
        } as const
        if (indeterminate.todos) {
          res.push({...indeterminate, type: 'todo', todos: indeterminate.todos, txt: undefined})
        } else if (indeterminate.txt) {
          res.push({...indeterminate, type: 'note', txt: indeterminate.txt, todos: undefined})
        }
      }
    }
    await db.notes.bulkPut(res)
    setState((state) => {
      closeImportDialog(state)
    })
    notifications.show({title: 'Success', message: 'Notes imported'})
  } catch {
    setState((state) => {
      state.import.importDialog.error = 'Invalid file format'
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
      }
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
    closeKeepImportDialog()
    notifications.show({title: 'Success', message: 'Keep notes imported'})
  } catch (e) {
    console.error(e)
    setState((state) => {
      state.import.keepImportDialog.error = e instanceof Error ? e.message : 'Unknown error'
    })
  }
}
