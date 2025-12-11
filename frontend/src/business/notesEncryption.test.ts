import {describe, expect, it} from 'vitest'
import {deriveKey, generateMasterSalt} from '../util/pbkdf2'
import {DecryptedProtectedNote, Note} from './models'
import {
  decryptNotes,
  decryptProtectedNote,
  encryptNotes,
  encryptProtectedNote,
} from './notesEncryption'

describe('notesEncryption', () => {
  it('should encrypt and decrypt one protected note', async () => {
    const salt = generateMasterSalt()
    const key = await deriveKey('test', salt)
    const note: Note = {
      id: '1',
      txt: 'This is a test note',
      title: 'Test Note',
      updated_at: Date.now(),
      created_at: Date.now(),
      version: 1,
      state: 'synced',
      deleted_at: 0,
      type: 'note',
      labels: [],
      archived: 0,
    }
    const encryptedNote = await encryptProtectedNote(key, note, salt)
    const decryptedNote = await decryptProtectedNote(key, encryptedNote)
    expect(decryptedNote.txt).toEqual(note.txt)
    expect(decryptedNote.title).toEqual(note.title)
    expect(decryptedNote.updated_at).toEqual(note.updated_at)
    expect(decryptedNote.created_at).toEqual(note.created_at)
    expect(decryptedNote.version).toEqual(note.version)
    expect(decryptedNote.state).toEqual(note.state)
    expect(decryptedNote.deleted_at).toEqual(note.deleted_at)
    expect(decryptedNote.type).toEqual(note.type)
    expect(decryptedNote.labels).toEqual(note.labels)
    expect(decryptedNote.archived).toEqual(note.archived)
  })

  it('should encrypt and decrypt multiple protected notes', async () => {
    const salt = generateMasterSalt()
    const key = await deriveKey('test', salt)
    const notes: DecryptedProtectedNote[] = [
      {
        id: '1',
        txt: 'This is a test note',
        title: 'Test Note',
        updated_at: Date.now(),
        created_at: Date.now(),
        version: 1,
        state: 'synced',
        deleted_at: 0,
        type: 'note',
        labels: [],
        archived: 0,
        protected: true,
        salt,
      },
      {
        id: '2',
        txt: 'This is a test note 2',
        title: 'Test Note 2',
        updated_at: Date.now(),
        created_at: Date.now(),
        version: 1,
        state: 'synced',
        deleted_at: 0,
        type: 'note',
        labels: [],
        archived: 0,
        protected: true,
        salt,
      },
    ]

    const encryptedNotes = await encryptNotes(key, notes)
    const decryptedNotes = await decryptNotes(key, encryptedNotes)
    expect(decryptedNotes).toEqual(notes)
  })
})
