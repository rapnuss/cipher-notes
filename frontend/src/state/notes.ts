import {
  Note,
  NoteHistoryItem,
  OpenNote,
  NoteSortProp,
  Todo,
  activeLabelIsUuid,
  Label,
  FileMeta,
  FilePull,
  FilePullWithState,
  filePullDellKeys,
  filePullDefExtraKeys,
} from '../business/models'
import {getState, setState, subscribe} from './store'
import {
  debounce,
  deepEquals,
  moveWithinListViaDnD,
  nonConcurrent,
  partitionBy,
  takeJsonSize,
} from '../util/misc'
import {EncPut, isUnauthorizedRes, reqSyncNotes} from '../services/backend'
import {Put, decryptSyncData, encryptSyncData} from '../business/notesEncryption'
import {
  db,
  hasDirtyFilesMetaObservable,
  hasDirtyLabelsObservable,
  hasDirtyNotesObservable,
} from '../db'
import {
  deriveTodosData,
  fileMetaToPull,
  fileToPut,
  labelToPut,
  mergeNoteConflicts,
  mergeFileConflicts,
  mergeLabelConflicts,
  notesIsEmpty,
  noteToPut,
  putToFile,
  putToLabel,
  putToNote,
  textToTodos,
  todosHaveIdsAndUpdatedAt,
  todosToText,
} from '../business/misc'
import socket from '../socket'
import {
  loadNotesSortOrder,
  loadOpenNoteId,
  storeNotesSortOrder,
  storeOpenNoteId,
} from '../services/localStorage'
import XSet from '../util/XSet'
import {notifications} from '@mantine/notifications'
import {UserState} from './user'
import {setOpenFile, upDownloadBlobsAndSetState} from './files'

export type NotesState = {
  query: string
  openNote: OpenNote | null
  noteDialog: {
    labelDropdownOpen: boolean
    moreMenuOpen: boolean
  }
  sort: {prop: NoteSortProp; desc: boolean}
  sync: {
    dialogOpen: boolean
    syncing: boolean
    error: string | null
  }
}

export const notesInit: NotesState = {
  query: '',
  openNote: null,
  noteDialog: {
    labelDropdownOpen: false,
    moreMenuOpen: false,
  },
  sort: {prop: 'updated_at', desc: true},
  sync: {
    dialogOpen: false,
    syncing: false,
    error: null,
  },
}

// init
loadNotesSortOrder().then((sort) => {
  if (sort) {
    setState((state) => {
      state.notes.sort = sort
    })
  }
})

new Promise((resolve) => window.addEventListener('DOMContentLoaded', resolve)).then(() => {
  onFocus()
  window.addEventListener('focus', onFocus)
})

loadOpenNoteId().then((id) => {
  if (id) {
    noteOpened(id)
  }
})

const onFocus = debounce(() => {
  syncNotes()
}, 10)

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'hidden') {
    await storeOpenNote()
    await syncNotes()
  }
})

// actions
export const noteQueryChanged = (query: string) =>
  setState((state) => {
    state.notes.query = query
  })
export const setLabelDropdownOpen = (open: boolean) =>
  setState((state) => {
    state.notes.noteDialog.labelDropdownOpen = open
  })
export const setMoreMenuOpen = (open: boolean) =>
  setState((state) => {
    state.notes.noteDialog.moreMenuOpen = open
  })
export const noteOpened = async (id: string) => {
  const note = await db.notes.get(id)
  if (!note || note.deleted_at !== 0) return
  setState((state) => {
    if (note.type === 'todo') {
      state.notes.openNote = {
        type: 'todo',
        id,
        todos: note.todos,
        title: note.title,
        updatedAt: note.updated_at,
        archived: note.archived === 1,
      }
    } else {
      state.notes.openNote = {
        type: 'note',
        id,
        txt: note.txt,
        title: note.title,
        updatedAt: note.updated_at,
        archived: note.archived === 1,
      }
    }
  })
  // TODO: remove this; second set state triggers storeOpenNote which triggers a sync
  if (note.type === 'todo' && !todosHaveIdsAndUpdatedAt(note.todos)) {
    setState((state) => {
      if (!state.notes.openNote) return
      state.notes.openNote.todos = note.todos.map(({id, updated_at, ...t}) => ({
        ...t,
        id: id ?? crypto.randomUUID(),
        updated_at: updated_at ?? Date.now(),
      }))
    })
  }
}
export const noteClosed = async () => {
  const state = getState()
  const openNote = state.notes.openNote
  if (!openNote) return

  if (
    openNote.title === '' &&
    (openNote.type === 'todo'
      ? openNote.todos.length === 0 ||
        (openNote.todos.length === 1 && openNote.todos[0]!.txt === '')
      : openNote.txt === '')
  ) {
    return await deleteOpenNote()
  }

  await storeOpenNote()

  setState((state) => {
    state.notes.openNote = null
    state.notes.noteDialog = {
      labelDropdownOpen: false,
      moreMenuOpen: false,
    }
  })
}
export const addNote = async () => {
  const now = Date.now()
  const id = crypto.randomUUID()
  const {activeLabel} = getState().labels
  const note: Note = {
    id,
    txt: '',
    version: 1,
    state: 'dirty',
    created_at: now,
    updated_at: now,
    deleted_at: 0,
    type: 'note',
    title: '',
    labels: activeLabelIsUuid(activeLabel) ? [activeLabel] : undefined,
    archived: 0,
  }
  await db.notes.add(note)

  setState((state) => {
    state.notes.openNote = {type: 'note', id, txt: '', title: '', updatedAt: now, archived: false}
  })
}
export const openNoteTitleChanged = (title: string) =>
  setState((state) => {
    if (!state.notes.openNote) return
    state.notes.openNote.title = title
    state.notes.openNote.updatedAt = Date.now()
  })
export const openNoteTxtChanged = (txt: string) =>
  setState((state) => {
    if (!state.notes.openNote) return
    state.notes.openNote.txt = txt
    state.notes.openNote.updatedAt = Date.now()
  })
export const openNoteTypeToggled = () =>
  setState((state) => {
    if (!state.notes.openNote) return
    if (state.notes.openNote.type === 'note') {
      state.notes.openNote = {
        type: 'todo',
        id: state.notes.openNote.id,
        todos: textToTodos(state.notes.openNote.txt),
        title: state.notes.openNote.title,
        updatedAt: Date.now(),
        archived: state.notes.openNote.archived,
      }
    } else {
      state.notes.openNote = {
        type: 'note',
        id: state.notes.openNote.id,
        txt: todosToText(state.notes.openNote.todos),
        title: state.notes.openNote.title,
        updatedAt: Date.now(),
        archived: state.notes.openNote.archived,
      }
    }
  })
export const openNoteArchivedToggled = () =>
  setState((state) => {
    if (!state.notes.openNote) return
    state.notes.openNote.archived = !state.notes.openNote.archived
    state.notes.openNote.updatedAt = Date.now()
  })

export const todoChecked = (id: string, checked: boolean) =>
  setState((state) => {
    if (
      !state.notes.openNote ||
      state.notes.openNote.type !== 'todo' ||
      !state.notes.openNote.todos.find((t) => t.id === id)
    )
      return

    const todos = state.notes.openNote.todos
    const todo = todos.find((t) => t.id === id)!

    if (todo.done === checked) return

    todo.done = checked
    todo.updated_at = Date.now()

    const children = todos.filter((t) => t.parent === todo.id)
    if (checked) {
      for (const child of children) {
        if (child.done) {
          continue
        }
        child.done = true
        child.updated_at = Date.now()
      }
    } else if (!checked && children.every((c) => c.done)) {
      for (const child of children) {
        child.done = false
        child.updated_at = Date.now()
      }
    }

    const parent = todos.find((t) => t.id === todo.parent)
    if (!checked && parent && parent.done) {
      parent.done = false
      parent.updated_at = Date.now()
    }

    state.notes.openNote.updatedAt = Date.now()
  })
export const todoChanged = (id: string, txt: string) =>
  setState((state) => {
    if (!state.notes.openNote || state.notes.openNote.type !== 'todo') return
    const todo = state.notes.openNote.todos.find((t) => t.id === id)!
    todo.txt = txt
    todo.updated_at = Date.now()
    state.notes.openNote.updatedAt = Date.now()
  })
export const insertTodo = (todoId?: string, parentId?: string, txt?: string) =>
  setState((state) => {
    if (!state.notes.openNote || state.notes.openNote.type !== 'todo') return
    const todos = state.notes.openNote.todos
    const todoIndex = todoId ? todos.findIndex((t) => t.id === todoId) : -1
    const hasChildren = todos.some((t) => t.parent === todoId)
    state.notes.openNote.todos.splice(todoIndex + 1, 0, {
      txt: txt ?? '',
      done: false,
      id: crypto.randomUUID(),
      updated_at: Date.now(),
      parent: hasChildren ? todoId : parentId,
    })
    state.notes.openNote.updatedAt = Date.now()
  })
export const deleteTodo = (id: string, appendAbove?: boolean) =>
  setState((state) => {
    if (!state.notes.openNote || state.notes.openNote.type !== 'todo') return

    const todos = state.notes.openNote.todos
    const {idToTodo, visualOrderUndone} = deriveTodosData(todos)
    const todo = idToTodo[id]!
    const visualIndex = visualOrderUndone.indexOf(id)
    if (appendAbove && visualIndex > 0 && todo.txt) {
      const aboveId = visualOrderUndone[visualIndex - 1]!
      const aboveDraft = todos.find((t) => t.id === aboveId)!
      aboveDraft.txt = aboveDraft.txt + todo.txt
      aboveDraft.updated_at = Date.now()
    }

    state.notes.openNote.todos = todos.filter((t) => t.id !== id && t.parent !== id)
    state.notes.openNote.updatedAt = Date.now()
  })
export const moveTodoByOne = (id: string, direction: 'up' | 'down') => {
  const state = getState()
  if (!state.notes.openNote || state.notes.openNote.type !== 'todo') return
  const todos = state.notes.openNote.todos
  const {visualOrderUndone, idToTodo} = deriveTodosData(todos)
  const todo = idToTodo[id]!
  const visualIndex = visualOrderUndone.indexOf(id)

  if (direction === 'up' && visualIndex === 0) {
    return
  } else if (direction === 'down' && visualIndex === visualOrderUndone.length - 1) {
    return
  }
  let dropId: string | undefined = undefined
  if (!todo.parent) {
    const inc = direction === 'up' ? -1 : 1
    for (let i = visualIndex + inc; i >= 0 && i < visualOrderUndone.length; i += inc) {
      const id = visualOrderUndone[i]!
      if (!idToTodo[id]!.parent) {
        dropId = id
        break
      }
    }
  } else {
    dropId = visualOrderUndone[visualIndex + (direction === 'up' ? -1 : 1)]!
  }
  if (dropId === undefined) {
    return
  }

  moveTodo({
    dragId: id,
    dropId,
    closestEdge: direction === 'up' ? 'top' : 'bottom',
    indent: !!todo.parent,
  })
}
export const moveTodo = ({
  dragId,
  dropId,
  closestEdge,
  indent,
}: {
  dragId: string
  dropId: string
  closestEdge: 'top' | 'bottom'
  indent: boolean
}) =>
  setState((state) => {
    if (!state.notes.openNote || state.notes.openNote.type !== 'todo') return
    const todos = state.notes.openNote.todos
    const derivedData = deriveTodosData(todos)
    const {idToTodo, visualOrderUndone, parentToChildIds} = derivedData
    let {todoTree} = derivedData
    const dropTodo = todos.find((t) => t.id === dropId)!
    const visualDropIndex = visualOrderUndone.indexOf(dropTodo.id)
    const aboveEdgeVisIdx = closestEdge === 'bottom' ? visualDropIndex : visualDropIndex - 1
    const aboveEdgeId = visualOrderUndone[aboveEdgeVisIdx]
    const aboveEdge = idToTodo[aboveEdgeId!]
    const dragTodo = todos.find((t) => t.id === dragId)!
    const dragChildIds = parentToChildIds[dragTodo.id]
    let moveUnderId = aboveEdge?.parent ?? aboveEdge?.id

    // move below itself, when not on top of the list, should move under the todo above itself
    if (aboveEdge?.id === dragTodo.id && aboveEdgeVisIdx > 0) {
      const aboveSelfId = visualOrderUndone[aboveEdgeVisIdx - 1]!
      const aboveSelf = idToTodo[aboveSelfId]!
      moveUnderId = aboveSelf.parent ?? aboveSelf.id
    }

    // move parent to its own children
    if (dragTodo.id === aboveEdge?.parent) {
      return
    }
    // indent above first todo
    else if (indent && aboveEdgeVisIdx === -1) {
      return
    }
    // move below itself, when on top of the list, should do nothing
    else if (aboveEdge?.id === dragTodo.id && aboveEdgeVisIdx === 0) {
      return
    }
    // move within children
    else if (indent && moveUnderId === dragTodo.parent) {
      const parentNode = todoTree.find(([id]) => id === dragTodo.parent)!
      const dragIndex = parentNode[1].findIndex((id) => id === dragTodo.id)
      const dropIndex = parentNode[1].findIndex((id) => id === dropTodo.id)
      moveWithinListViaDnD(parentNode[1], dragIndex, dropIndex, closestEdge)
    }
    // move from children to children
    else if (indent && dragTodo.parent) {
      const fromParent = todoTree.find(([id]) => id === dragTodo.parent)!
      const toParent = todoTree.find(([id]) => id === moveUnderId)!
      fromParent[1] = fromParent[1].filter((id) => id !== dragTodo.id)
      toParent[1].push(dragTodo.id)
    }
    // move from children to list
    else if (!indent && dragTodo.parent) {
      const parentNode = todoTree.find(([id]) => id === dragTodo.parent)!
      parentNode[1] = parentNode[1].filter((id) => id !== dragTodo.id)
      const targetIndex = todoTree.findIndex(([id]) => id === moveUnderId)
      todoTree.splice(targetIndex + 1, 0, [dragTodo.id, []])
    }
    // move parent without children in list
    // move parent with children in list
    else if (!indent && dragTodo.parent === undefined) {
      const dragIndex = todoTree.findIndex(([id]) => id === dragId)
      const dropParentId = dropTodo.parent ?? dropTodo.id
      const dropIndex = todoTree.findIndex(([id]) => id === dropParentId)
      const closestParentEdge = dropTodo.parent ? 'bottom' : closestEdge
      moveWithinListViaDnD(todoTree, dragIndex, dropIndex, closestParentEdge)
    }
    // move parent without children to children
    // move parent without children under parent without children
    // move parent with children to children
    // move parent with children under parent without children
    else if (indent && dragTodo.parent === undefined) {
      const insertNode = todoTree.find(([id]) => id === moveUnderId)
      if (!insertNode) {
        return
      }
      insertNode[1].push(dragTodo.id)
      for (const child of dragChildIds ?? []) {
        insertNode[1].push(child)
      }
      todoTree = todoTree.filter(([id]) => id !== dragTodo.id)
    }

    const newTodos: Todo[] = []
    for (const [id, children] of todoTree) {
      const todo = idToTodo[id]!
      if (todo.parent !== undefined) {
        todo.parent = undefined
        todo.updated_at = Date.now()
      }
      newTodos.push(todo)
      for (const childId of children) {
        const child = idToTodo[childId]!
        if (child.parent !== todo.id) {
          child.parent = todo.id
          child.updated_at = Date.now()
        }
        newTodos.push(child)
      }
    }

    state.notes.openNote.todos = newTodos
    state.notes.openNote.updatedAt = Date.now()
  })
export const openNoteHistoryHandler = (historyItem: NoteHistoryItem | null) => {
  if (!historyItem) {
    return
  }
  setState((state) => {
    if (!state.notes.openNote) return
    if (historyItem.type === 'note') {
      state.notes.openNote.type = 'note'
      state.notes.openNote.txt = historyItem.txt
    } else {
      state.notes.openNote.type = 'todo'
      state.notes.openNote.todos = historyItem.todos
    }
    state.notes.openNote.updatedAt = Date.now()
  })
}
export const sortChanged = (prop: NoteSortProp) =>
  setState((state) => {
    state.notes.sort.prop = prop
  })
export const sortDirectionChanged = () =>
  setState((state) => {
    state.notes.sort.desc = !state.notes.sort.desc
  })
export const deleteNote = async (id: string) => {
  const note = await db.notes.get(id)
  if (!note || note.deleted_at !== 0) return
  if (note.version === 1 && note.state === 'dirty') {
    await db.notes.delete(id)
  } else {
    await db.notes.update(id, {
      deleted_at: Date.now(),
      txt: '',
      todos: [],
      state: 'dirty',
      version: note.state === 'dirty' ? note.version : note.version + 1,
    })
  }
}
export const setNoteArchived = (id: string, archived: boolean) =>
  db.notes
    .where('id')
    .equals(id)
    .modify((note) => {
      note.archived = archived ? 1 : 0
      note.updated_at = Date.now()
      if (note.state === 'synced') {
        note.state = 'dirty'
        note.version = note.version + 1
      }
    })
export const deleteOpenNote = async () => {
  const state = getState()
  if (!state.notes.openNote) return
  const note = await db.notes.get(state.notes.openNote.id)
  if (!note) return
  if (note.version === 1 && note.state === 'dirty') {
    await db.notes.delete(state.notes.openNote.id)
  } else {
    await db.notes.update(state.notes.openNote.id, {
      deleted_at: Date.now(),
      txt: '',
      todos: [],
      state: 'dirty',
      version: note.state === 'dirty' ? note.version : note.version + 1,
    })
  }
  setState((state) => {
    state.notes.openNote = null
    state.notes.noteDialog = {labelDropdownOpen: false, moreMenuOpen: false}
  })
}
export const openSyncDialogAndSync = () => {
  const state = getState()
  if (state.notes.sync.syncing || state.notes.sync.dialogOpen) return
  setState((state) => {
    state.notes.sync.dialogOpen = true
  })
  syncNotes()
}
export const closeSyncDialog = () =>
  setState((state) => {
    state.notes.sync.dialogOpen = false
  })

// effects
const loadEncPuts = async (
  keyTokenPair: NonNullable<UserState['user']['keyTokenPair']>,
  bytesLimit: number
): Promise<{
  encPuts: EncPut[]
  dirtyNotes: Note[]
  dirtyLabels: Label[]
  dirtyFiles: FileMeta[]
}> => {
  const someDirtyNotes = await db.notes
    .where('state')
    .equals('dirty')
    .and((n) => !notesIsEmpty(n))
    .limit(1000)
    .toArray()
  const someDirtyLabels = await db.labels.where('state').equals('dirty').limit(1000).toArray()
  const someDirtyFiles = await db.files_meta.where('state').equals('dirty').limit(1000).toArray()

  const someClientPuts: Put[] = someDirtyLabels
    .map(labelToPut)
    .concat(someDirtyFiles.map(fileToPut))
    .concat(someDirtyNotes.map(noteToPut))

  const someEncPuts = await encryptSyncData(
    keyTokenPair.cryptoKey,
    takeJsonSize(someClientPuts, bytesLimit)
  )
  const encPuts = takeJsonSize(someEncPuts, bytesLimit)
  return {
    encPuts,
    dirtyNotes: someDirtyNotes.filter((n) => encPuts.some((p) => p.id === n.id)),
    dirtyLabels: someDirtyLabels.filter((l) => encPuts.some((p) => p.id === l.id)),
    dirtyFiles: someDirtyFiles.filter((f) => encPuts.some((p) => p.id === f.id)),
  }
}

export const syncNotes = nonConcurrent(async () => {
  const state = getState()
  const lastSyncedTo = state.user.user.lastSyncedTo
  const keyTokenPair = state.user.user.keyTokenPair
  const loggedIn = state.user.user.loggedIn
  if (!keyTokenPair || !loggedIn || state.notes.sync.syncing) {
    return
  }
  setState((state) => {
    state.notes.sync.syncing = true
  })
  try {
    const {encPuts, dirtyNotes, dirtyLabels, dirtyFiles} = await loadEncPuts(
      keyTokenPair,
      1024 * 1024
    )
    const res = await reqSyncNotes(lastSyncedTo, encPuts, keyTokenPair.syncToken)
    if (!res.success) {
      setState((state) => {
        state.notes.sync.error = res.error
        if (isUnauthorizedRes(res)) {
          state.user.user.loggedIn = false
        }
        if (state.notes.sync.dialogOpen) {
          notifications.show({title: 'Failed to sync notes', message: res.error, color: 'red'})
        }
      })
      return
    }
    const pulls: Put[] = await decryptSyncData(keyTokenPair.cryptoKey, res.data.puts)
    const {
      label: pullLabels = [],
      note: pullNotes = [],
      file: pullFiles = [],
    } = partitionBy(pulls, (p) => p.type)
    const serverConflicts: Put[] = await decryptSyncData(keyTokenPair.cryptoKey, res.data.conflicts)
    const {
      label: serverConflictsLabels = [],
      note: serverConflictsNotes = [],
      file: serverConflictsFiles = [],
    } = partitionBy(serverConflicts, (p) => p.type)

    const baseVersions: Note[] = await db.note_base_versions
      .where('id')
      .anyOf(serverConflicts.map((n) => n.id))
      .toArray()

    const {merged: mergedNotes, conflicts: noteConflicts} = mergeNoteConflicts(
      baseVersions,
      dirtyNotes,
      serverConflictsNotes.map(putToNote)
    )
    const mergedLabels: Label[] = mergeLabelConflicts(
      dirtyLabels,
      serverConflictsLabels.map(putToLabel)
    )
    const mergedFiles: FilePull[] = mergeFileConflicts(
      dirtyFiles.map(fileMetaToPull),
      serverConflictsFiles.map(putToFile)
    )

    const labelsToStore: Record<string, Label> = Object.fromEntries(
      pullLabels
        .map(putToLabel)
        .concat(mergedLabels)
        .map((l) => [l.id, l])
    )
    const notesToStore: Record<string, Note> = Object.fromEntries(
      pullNotes
        .map(putToNote)
        .concat(mergedNotes)
        .map((n) => [n.id, n])
    )
    const filesToStore: Record<string, FilePullWithState> = Object.fromEntries(
      [
        ...pullFiles.map(putToFile).map((f): FilePullWithState => ({...f, state: 'synced'})),
        ...mergedFiles.map((f): FilePullWithState => ({...f, state: 'dirty'})),
      ].map((f) => [f.id, f])
    )

    const idToUploaded = Object.fromEntries(dirtyNotes.map((n) => [n.id, n]))
    const idToUploadedLabels = Object.fromEntries(dirtyLabels.map((l) => [l.id, l]))
    const idToUploadedFiles = Object.fromEntries(dirtyFiles.map((f) => [f.id, f]))

    await db.transaction(
      'rw',
      db.notes,
      db.note_base_versions,
      db.labels,
      db.files_meta,
      async (tx) => {
        const existingLabelIds = new XSet<string>()
        await tx.labels
          .where('id')
          .anyOf(Object.keys(labelsToStore))
          .modify((curr, ref) => {
            existingLabelIds.add(curr.id)
            const uploaded = idToUploadedLabels[curr.id]
            const toStore = labelsToStore[curr.id]!
            if (uploaded && curr.updated_at > uploaded.updated_at) {
              curr.version = curr.version + 1
              return
            }
            if (curr.version >= toStore.version && curr.updated_at !== toStore.updated_at) {
              return
            }
            ref.value = toStore
          })
        const insertLabelIds = XSet.fromItr(Object.keys(labelsToStore))
          .without(existingLabelIds)
          .toArray()
        await tx.labels.bulkPut(insertLabelIds.map((id) => labelsToStore[id]!))

        const existingFileIds = new XSet<string>()
        await tx.files_meta
          .where('id')
          .anyOf(Object.keys(filesToStore))
          .modify((curr) => {
            existingFileIds.add(curr.id)
            const uploaded = idToUploadedFiles[curr.id]
            const toStore = filesToStore[curr.id]!
            if (uploaded && curr.updated_at > uploaded.updated_at) {
              curr.version = curr.version + 1
              return
            }
            if (curr.version >= toStore.version && curr.updated_at !== toStore.updated_at) {
              return
            }
            for (const key of filePullDellKeys) {
              curr[key] = toStore[key] as never
            }
            if (toStore.deleted_at === 0 && toStore.title !== undefined) {
              for (const key of filePullDefExtraKeys) {
                curr[key] = toStore[key] as never
              }
            } else {
              curr.title = ''
              curr.labels = []
            }
            curr.state = toStore.state
          })
        const insertFileIds = XSet.fromItr(Object.keys(filesToStore))
          .without(existingFileIds)
          .toArray()
        await tx.files_meta.bulkPut(
          insertFileIds
            .map((id) => ({...filesToStore[id]!, has_thumb: 0, blob_state: 'remote'} as const))
            .filter((f) => f.title !== undefined)
        )

        const baseVersions: Note[] = []
        const existingNoteIds = new XSet<string>()
        await tx.notes
          .where('id')
          .anyOf(Object.keys(notesToStore))
          .modify((curr, ref) => {
            existingNoteIds.add(curr.id)
            const uploaded = idToUploaded[curr.id]
            const toStore = notesToStore[curr.id]!
            if (uploaded && curr.updated_at > uploaded.updated_at) {
              curr.version = curr.version + 1
              return
            }
            if (curr.version >= toStore.version && curr.updated_at !== toStore.updated_at) {
              return
            }
            ref.value = toStore
            if (toStore.state === 'synced') baseVersions.push(toStore)
          })

        const insertNoteIds = XSet.fromItr(Object.keys(notesToStore))
          .without(existingNoteIds)
          .toArray()
        const insertNotes = insertNoteIds.map((id) => notesToStore[id]!)
        await tx.notes.bulkPut(insertNotes)
        await tx.note_base_versions.bulkPut(baseVersions.concat(insertNotes))
      }
    )

    setOpenNote(notesToStore)
    setOpenFile(filesToStore)

    await db.transaction('rw', db.notes, db.note_base_versions, async (tx) => {
      const syncedDeleteIds = await tx.notes
        .where('deleted_at')
        .notEqual(0)
        .and((n) => n.state === 'synced')
        .primaryKeys()
      await tx.notes.bulkDelete(syncedDeleteIds)
      await tx.note_base_versions.bulkDelete(syncedDeleteIds)
    })
    await db.transaction('rw', db.files_meta, db.files_blob, db.files_thumb, async (tx) => {
      const syncedDeleteIds = await tx.files_meta
        .where('deleted_at')
        .notEqual(0)
        .and((f) => f.state === 'synced')
        .primaryKeys()
      await tx.files_meta.bulkDelete(syncedDeleteIds)
      await tx.files_blob.bulkDelete(syncedDeleteIds)
      await tx.files_thumb.bulkDelete(syncedDeleteIds)
    })

    setState((state) => {
      state.conflicts.conflicts = noteConflicts
      state.user.user.lastSyncedTo = res.data.synced_to
      state.notes.sync.error = null
      if (state.notes.sync.dialogOpen) {
        notifications.show({
          title: 'Success',
          message: `Notes synced with ${serverConflicts.length} conflicts`,
        })
      }
    })
    upDownloadBlobsAndSetState()
  } catch (e) {
    setState((state) => {
      const message = e instanceof Error ? e.message : 'Unknown error'
      state.notes.sync.error = message
      if (state.notes.sync.dialogOpen) {
        notifications.show({
          title: 'Failed to sync notes',
          message,
          color: 'red',
        })
      }
    })
  } finally {
    setState((state) => {
      state.notes.sync.syncing = false
    })
  }
})

const setOpenNote = (syncedNotes: Record<string, Note>) => {
  const openNote = getState().notes.openNote
  if (!openNote) {
    return
  }
  const note = syncedNotes[openNote.id]
  if (!note) {
    return
  }
  if (note.deleted_at !== 0) {
    return setState((state) => {
      state.notes.openNote = null
    })
  }
  // TODO: handle clock differences between clients
  if (note.updated_at > openNote.updatedAt) {
    setState((state) => {
      state.notes.openNote =
        note.type === 'note'
          ? {
              type: note.type,
              id: note.id,
              title: note.title,
              txt: note.txt,
              updatedAt: note.updated_at,
              archived: note.archived === 1,
            }
          : {
              type: note.type,
              id: note.id,
              title: note.title,
              todos: note.todos,
              updatedAt: note.updated_at,
              archived: note.archived === 1,
            }
    })
  }
}

const storeOpenNote = nonConcurrent(async () => {
  const openNote = getState().notes.openNote
  if (!openNote) return

  const note = await db.notes.get(openNote.id)

  if (
    note &&
    (note.title !== openNote.title ||
      note.type !== openNote.type ||
      !!note.archived !== openNote.archived ||
      (note.type === 'note' && note.txt !== openNote.txt) ||
      (note.type === 'todo' && !deepEquals(note.todos, openNote.todos)))
  ) {
    await db.notes.update(openNote.id, {
      type: openNote.type,
      title: openNote.title,
      txt: openNote.type === 'note' ? openNote.txt : undefined,
      todos: openNote.type === 'todo' ? openNote.todos : undefined,
      updated_at: openNote.updatedAt,
      state: 'dirty',
      version: note.state === 'dirty' ? note.version : note.version + 1,
      archived: openNote.archived ? 1 : 0,
    })
  }
})

// subscriptions
export const registerNotesSubscriptions = () => {
  const storeOpenNoteDebounced = debounce(storeOpenNote, 1000)

  subscribe((state) => state.notes.sort, storeNotesSortOrder)
  subscribe(
    (state) => state.notes.openNote,
    (curr, prev) => curr && prev && storeOpenNoteDebounced()
  )
  subscribe(
    (state) => state.conflicts.conflicts.length !== 0,
    (hasConflicts) => {
      if (hasConflicts) {
        noteClosed()
      }
    }
  )
  subscribe((state) => state.notes.openNote?.id ?? null, storeOpenNoteId)

  const syncNotesDebounced = debounce(syncNotes, 1000)
  hasDirtyNotesObservable.subscribe((hasDirtyNotes) => {
    if (hasDirtyNotes) {
      syncNotesDebounced()
    }
  })
  hasDirtyLabelsObservable.subscribe((hasDirtyLabels) => {
    if (hasDirtyLabels) {
      syncNotesDebounced()
    }
  })
  hasDirtyFilesMetaObservable.subscribe((hasDirtyFiles) => {
    if (hasDirtyFiles) {
      syncNotesDebounced()
    }
  })

  socket.on('notesPushed', () => {
    syncNotes()
  })
}
