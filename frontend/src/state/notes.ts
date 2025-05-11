import {Note, NoteHistoryItem, OpenNote, NoteSortProp, Todo} from '../business/models'
import {getState, setState, subscribe} from './store'
import {bisectBy, debounce, deepEquals, moveWithinListViaDnD, nonConcurrent} from '../util/misc'
import {isUnauthorizedRes, reqSyncNotes} from '../services/backend'
import {Put, decryptSyncData, encryptSyncData} from '../business/notesEncryption'
import {db, hasDirtyLabelsObservable, hasDirtyNotesObservable} from '../db'
import {
  deriveTodosData,
  labelToPut,
  mergeConflicts,
  mergeLabelConflicts,
  notesIsEmpty,
  noteToPut,
  putToLabel,
  putToNote,
  textToTodos,
  todosHaveIdsAndUpdatedAt,
  todosToText,
} from '../business/misc'
import socket from '../socket'
import {loadNotesSortOrder, storeNotesSortOrder} from '../services/localStorage'
import XSet from '../util/XSet'
import {notifications} from '@mantine/notifications'

export type NotesState = {
  query: string
  openNote: OpenNote | null
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
      }
    } else {
      state.notes.openNote = {
        type: 'note',
        id,
        txt: note.txt,
        title: note.title,
        updatedAt: note.updated_at,
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
    labels: activeLabel ? [activeLabel] : undefined,
  }
  await db.notes.add(note)

  setState((state) => {
    state.notes.openNote = {type: 'note', id, txt: '', title: '', updatedAt: now}
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
      }
    } else {
      state.notes.openNote = {
        type: 'note',
        id: state.notes.openNote.id,
        txt: todosToText(state.notes.openNote.todos),
        title: state.notes.openNote.title,
        updatedAt: Date.now(),
      }
    }
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
export const insertTodo = (bellowId?: string) =>
  setState((state) => {
    if (!state.notes.openNote || state.notes.openNote.type !== 'todo') return
    const belowIndex = bellowId
      ? state.notes.openNote.todos.findIndex((t) => t.id === bellowId)
      : -1
    state.notes.openNote.todos.splice(belowIndex + 1, 0, {
      txt: '',
      done: false,
      id: crypto.randomUUID(),
      updated_at: Date.now(),
    })
    state.notes.openNote.updatedAt = Date.now()
  })
export const deleteTodo = (id: string) =>
  setState((state) => {
    if (!state.notes.openNote || state.notes.openNote.type !== 'todo') return

    const todos = state.notes.openNote.todos

    state.notes.openNote.todos = todos.filter((t) => t.id !== id && t.parent !== id)
    state.notes.openNote.updatedAt = Date.now()
  })
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
    const moveUnderId = aboveEdge?.parent ?? aboveEdge?.id

    // move parent to its own children
    if (dragTodo.id === aboveEdge?.parent) {
      return
    }
    // indent above first todo
    else if (indent && aboveEdgeVisIdx === -1) {
      return
    }
    // move below itself indented and not indented should do nothing
    else if (aboveEdge?.id === dragTodo.id) {
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
      const dragIndex = todoTree.findIndex(([id]) => id === dragTodo.id)
      const dropIndex = todoTree.findIndex(([id]) => id === dropTodo.id)
      moveWithinListViaDnD(todoTree, dragIndex, dropIndex, closestEdge)
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
      state: 'dirty',
      version: note.state === 'dirty' ? note.version : note.version + 1,
    })
  }
  setState((state) => {
    state.notes.openNote = null
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
    const dirtyNotes = await db.notes
      .where('state')
      .equals('dirty')
      .and((n) => !notesIsEmpty(n))
      .toArray()
    const dirtyLabels = await db.labels.where('state').equals('dirty').toArray()
    const clientPuts: Put[] = dirtyNotes.map(noteToPut).concat(dirtyLabels.map(labelToPut))
    const encClientSyncData = await encryptSyncData(keyTokenPair.cryptoKey, clientPuts)

    const res = await reqSyncNotes(lastSyncedTo, encClientSyncData, keyTokenPair.syncToken)
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
    const pulls = await decryptSyncData(keyTokenPair.cryptoKey, res.data.puts)
    const [pullLabels, pullNotes] = bisectBy(pulls, (p) => p.type === 'label')
    const serverConflicts = await decryptSyncData(keyTokenPair.cryptoKey, res.data.conflicts)
    const [serverConflictsLabels, serverConflictsNotes] = bisectBy(
      serverConflicts,
      (p) => p.type === 'label'
    )

    const baseVersions = await db.note_base_versions
      .where('id')
      .anyOf(serverConflicts.map((n) => n.id))
      .toArray()
    const {merged, conflicts} = mergeConflicts(
      baseVersions,
      dirtyNotes,
      serverConflictsNotes.map(putToNote)
    )
    const mergedLabels = mergeLabelConflicts(dirtyLabels, serverConflictsLabels.map(putToLabel))
    const labelsToStore = Object.fromEntries(
      pullLabels
        .map(putToLabel)
        .concat(mergedLabels)
        .map((l) => [l.id, l])
    )

    const toStoreById = Object.fromEntries(
      pullNotes
        .map(putToNote)
        .concat(merged)
        .map((n) => [n.id, n])
    )
    const idToUploaded = Object.fromEntries(dirtyNotes.map((n) => [n.id, n]))
    const idToUploadedLabels = Object.fromEntries(dirtyLabels.map((l) => [l.id, l]))

    await db.transaction('rw', db.notes, db.note_base_versions, db.labels, async () => {
      const existingLabelIds = new XSet<string>()
      await db.labels
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
      const insertLabelIds = XSet.fromItr(Object.keys(labelsToStore)).without(existingLabelIds)
      await db.labels.bulkPut(insertLabelIds.toArray().map((id) => labelsToStore[id]!))

      const baseVersions: Note[] = []
      const existingIds = new XSet<string>()
      await db.notes
        .where('id')
        .anyOf(Object.keys(toStoreById))
        .modify((curr, ref) => {
          existingIds.add(curr.id)
          const uploaded = idToUploaded[curr.id]
          const toStore = toStoreById[curr.id]!
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

      const insertIds = XSet.fromItr(Object.keys(toStoreById)).without(existingIds)
      const insertNotes = insertIds.toArray().map((id) => toStoreById[id]!)
      await db.notes.bulkPut(insertNotes)
      await db.note_base_versions.bulkPut(baseVersions.concat(insertNotes))
    })

    setOpenNote(toStoreById)

    const syncedDeletes = await db.notes
      .where('deleted_at')
      .notEqual(0)
      .and((n) => n.state === 'synced')
      .toArray()
    const syncedDeleteIds = syncedDeletes.map((d) => d.id)
    await db.notes.bulkDelete(syncedDeleteIds)
    await db.note_base_versions.bulkDelete(syncedDeleteIds)

    setState((state) => {
      state.conflicts.conflicts = conflicts
      state.user.user.lastSyncedTo = res.data.synced_to
      state.notes.sync.error = null
      if (state.notes.sync.dialogOpen) {
        notifications.show({
          title: 'Success',
          message: `Notes synced with ${serverConflicts.length} conflicts`,
        })
      }
    })
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
            }
          : {
              type: note.type,
              id: note.id,
              title: note.title,
              todos: note.todos,
              updatedAt: note.updated_at,
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
  subscribe(
    (state) => state.user.user.loggedIn,
    (curr, prev) => {
      if (!prev && curr) {
        syncNotes()
      }
    }
  )

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

  socket.on('notesPushed', () => {
    syncNotes()
  })
}
