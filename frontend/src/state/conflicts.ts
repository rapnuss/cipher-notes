import {db} from '../db'
import {getState, setState} from './store'
import {Note} from '../business/models'

export type ConflictsState = {conflicts: Note[]}

export const conflictsInit: ConflictsState = {conflicts: []}

export const pickLocalNote = async () => {
  const state = getState()
  const conflicts = state.conflicts.conflicts
  const serverPut = conflicts[0]
  if (!serverPut) return
  const localNote = await db.notes.get(serverPut.id)
  if (!localNote) return
  const updatedNote: Note = {
    ...localNote,
    version: Math.max(localNote.version, serverPut.version) + 1,
    state: 'dirty',
  }
  await db.notes.put(updatedNote)
  setState((state) => {
    state.conflicts.conflicts = state.conflicts.conflicts.slice(1)
  })
}

export const pickServerNote = async () => {
  const state = getState()
  const conflicts = state.conflicts.conflicts
  const serveNote = conflicts[0]
  if (!serveNote) return

  await db.notes.put(serveNote)

  setState((state) => {
    state.conflicts.conflicts = state.conflicts.conflicts.slice(1)
  })
}
