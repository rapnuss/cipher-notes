import {FileMeta, Note} from '../business/models'
import {db} from '../db'
import {openConfirmModalWithBackHandler} from '../helpers/openConfirmModal'
import XSet from '../util/XSet'
import {getState, RootState, setState} from './store'

export type SelectionState = {
  selected: {[id: string]: 'note' | 'file'}
  bulkLabelOpen: boolean
}

export const selectionInit: SelectionState = {
  selected: {},
  bulkLabelOpen: false,
}

export const toggleSelection = (id: string, type: 'note' | 'file') =>
  setState((state) => {
    const selected = state.selection.selected
    if (selected[id]) {
      delete selected[id]
    } else {
      selected[id] = type
    }
    state.selection.bulkLabelOpen = false
  })

export const clearSelection = () =>
  setState((state) => {
    state.selection.selected = {}
    state.selection.bulkLabelOpen = false
  })

export const selectSelectionActive = (state: RootState) => {
  for (const id in state.selection.selected) {
    if (state.selection.selected[id]) {
      return true
    }
  }
  return false
}

export const archiveSelected = () => {
  const selected = Object.keys(getState().selection.selected)
  if (selected.length === 0) return

  openConfirmModalWithBackHandler({
    id: 'archive-selected',
    title: `Archive ${selected.length} selected items?`,
    labels: {confirm: 'Archive', cancel: 'Cancel'},
    confirmProps: {color: 'blue'},
    onConfirm,
  })

  function onConfirm() {
    db.transaction('rw', db.notes, db.files_meta, async (tx) => {
      tx.notes.where('id').anyOf(selected).modify(archiveNote)
      tx.files_meta.where('id').anyOf(selected).modify(archiveNote)
      setState((state) => {
        state.selection.selected = {}
      })
    })
  }
  function archiveNote(rec: Note | FileMeta) {
    if (rec.archived === 1) return
    rec.archived = 1
    if (rec.state === 'synced') {
      rec.state = 'dirty'
      rec.version = rec.version + 1
    }
  }
}

export const unarchiveSelected = () => {
  const selected = Object.keys(getState().selection.selected)
  if (selected.length === 0) return

  openConfirmModalWithBackHandler({
    id: 'unarchive-selected',
    title: `Unarchive ${selected.length} selected items?`,
    labels: {confirm: 'Unarchive', cancel: 'Cancel'},
    confirmProps: {color: 'green'},
    onConfirm,
  })

  function onConfirm() {
    db.transaction('rw', db.notes, db.files_meta, async (tx) => {
      tx.notes.where('id').anyOf(selected).modify(unarchiveNote)
      tx.files_meta.where('id').anyOf(selected).modify(unarchiveNote)
      setState((state) => {
        state.selection.selected = {}
      })
    })
  }
  function unarchiveNote(rec: Note | FileMeta) {
    if (rec.archived === 0) return
    rec.archived = 0
    if (rec.state === 'synced') {
      rec.state = 'dirty'
      rec.version = rec.version + 1
    }
  }
}

export const deleteSelected = () => {
  const selected = Object.keys(getState().selection.selected)
  if (selected.length === 0) return

  openConfirmModalWithBackHandler({
    id: 'delete-selected',
    title: `Delete ${selected.length} selected items?`,
    labels: {confirm: 'Delete', cancel: 'Cancel'},
    confirmProps: {color: 'red'},
    onConfirm,
  })

  function onConfirm() {
    db.transaction('rw', db.notes, db.files_meta, async (tx) => {
      tx.notes.where('id').anyOf(selected).modify(deleteNote)
      tx.files_meta.where('id').anyOf(selected).modify(deleteNote)
      setState((state) => {
        state.selection.selected = {}
      })
    })
  }
  function deleteNote(rec: Note | FileMeta, ref: any) {
    if (rec.deleted_at) return
    if (rec.state === 'dirty' && rec.version === 1) {
      delete ref.value
      return
    }
    rec.deleted_at = Date.now()
    if (rec.state === 'synced') {
      rec.state = 'dirty'
      rec.version = rec.version + 1
    }
  }
}

export const toggleBulkLabelDropdown = () =>
  setState((state) => {
    state.selection.bulkLabelOpen = !state.selection.bulkLabelOpen
  })

export const openBulkLabelDropdown = () =>
  setState((state) => {
    state.selection.bulkLabelOpen = true
  })

export const closeBulkLabelDropdown = () =>
  setState((state) => {
    state.selection.bulkLabelOpen = false
  })

export const applyBulkLabels = async (updatedLabelState: Record<string, boolean | 'unchanged'>) => {
  const state = getState()
  const selected = Object.keys(state.selection.selected)

  const adds: string[] = [],
    removes: string[] = []
  for (const id in updatedLabelState) {
    if (updatedLabelState[id] === true) {
      adds.push(id)
    } else if (updatedLabelState[id] === false) {
      removes.push(id)
    }
  }

  if (selected.length === 0 || (adds.length === 0 && removes.length === 0)) return

  const addSet = XSet.fromItr(adds)
  const remSet = XSet.fromItr(removes)

  db.transaction('rw', db.notes, db.files_meta, async (tx) => {
    tx.notes.where('id').anyOf(selected).modify(applyBulkLabelsToItem)
    tx.files_meta.where('id').anyOf(selected).modify(applyBulkLabelsToItem)
  })

  function applyBulkLabelsToItem(rec: Note | FileMeta) {
    const initialLabels = XSet.fromItr(rec.labels ?? [])
    const newLabels = initialLabels.union(addSet).without(remSet)
    if (initialLabels.isEqualTo(newLabels)) {
      return
    }
    if (rec.state === 'synced') {
      rec.state = 'dirty'
      rec.version = rec.version + 1
    }
    rec.labels = newLabels.toArray()
  }

  setState((state) => {
    state.selection.bulkLabelOpen = false
    state.selection.selected = {}
  })
}
