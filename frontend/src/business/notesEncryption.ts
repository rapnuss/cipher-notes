import {z} from 'zod'
import {
  base64ToBin,
  calculateChecksum,
  decryptString,
  encryptString,
  importKey,
} from '../util/encryption'
import {EncPut} from '../services/backend'
import {DecryptedProtectedNote, Note, PlainNote, ProtectedNote, Todos} from './models'

type UpsertPut = {
  id: string
  type: 'note' | 'todo' | 'label' | 'file'
  created_at: number
  updated_at: number
  txt: string
  version: number
  deleted_at: null
}
export type Put =
  | UpsertPut
  | {
      id: string
      type: 'note' | 'todo' | 'label' | 'file'
      created_at: number
      updated_at: number
      txt: null
      version: number
      deleted_at: number
    }

export const decryptSyncData = async (cryptoKey: string, puts: EncPut[]): Promise<Put[]> => {
  const key = await importKey(cryptoKey)
  return await Promise.all(
    puts.map(async (p) => {
      const res: Put & {cipher_text?: string | null; iv?: string | null} =
        p.deleted_at === null && p.cipher_text !== null && p.iv !== null
          ? await decryptString(key, p.cipher_text, p.iv).then((txt) => ({
              ...p,
              txt,
            }))
          : {...p, txt: null}
      delete res.cipher_text
      delete res.iv
      return res
    })
  )
}

export const encryptSyncData = async (cryptoKey: string, puts: Put[]): Promise<EncPut[]> => {
  const key = await importKey(cryptoKey)
  return await Promise.all(
    puts.map(async (p) => {
      const res: EncPut & {txt?: string | null} =
        p.txt === null || p.deleted_at !== null
          ? {...p, cipher_text: null, iv: null}
          : await encryptString(key, p.txt).then(({cipher_text, iv}) => ({
              ...p,
              cipher_text,
              iv,
              deleted_at: null,
            }))
      delete res.txt
      return res
    })
  )
}

export const calcChecksum = (key: string, syncToken: string) => {
  const keyBin = base64ToBin(key)
  const syncTokenBin = base64ToBin(syncToken)
  return calculateChecksum(new Uint8Array([...keyBin, ...syncTokenBin]))
}

export const isValidKeyTokenPair = (keyTokenPair: string) => {
  const [cryptoKey, syncToken, checksum] = keyTokenPair.split(':')
  return (
    cryptoKey &&
    syncToken &&
    checksum &&
    z.string().base64().length(44).safeParse(cryptoKey).success &&
    z.string().base64().length(24).safeParse(syncToken).success &&
    calcChecksum(cryptoKey, syncToken) === Number(checksum)
  )
}

export const encryptProtectedNote = async (
  cryptoKey: CryptoKey,
  note: DecryptedProtectedNote
): Promise<ProtectedNote> => {
  if (note.type === 'note') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {txt, protected: _, type: _1, title, ...rest} = note
    const {cipher_text, iv} = await encryptString(cryptoKey, JSON.stringify({title, txt}))
    return {
      type: 'note_protected',
      ...rest,
      cipher_text,
      iv,
    }
  } else if (note.type === 'todo') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {todos, protected: _, type: _1, title, ...rest} = note
    const {cipher_text, iv} = await encryptString(cryptoKey, JSON.stringify({title, todos}))
    return {
      type: 'todo_protected',
      ...rest,
      cipher_text,
      iv,
    }
  } else {
    throw new Error('Invalid note')
  }
}

export const decryptProtectedNote = async (
  cryptoKey: CryptoKey,
  note: ProtectedNote
): Promise<DecryptedProtectedNote> => {
  if (note.type === 'note_protected') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {cipher_text, iv, type: _1, ...rest} = note
    const jsonStr = await decryptString(cryptoKey, cipher_text, iv)
    const {title, txt} = JSON.parse(jsonStr) as {title: string; txt: string}
    return {
      protected: true,
      type: 'note',
      ...rest,
      title,
      txt,
    }
  } else if (note.type === 'todo_protected') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {cipher_text, iv, type: _1, ...rest} = note
    const jsonStr = await decryptString(cryptoKey, cipher_text, iv)
    const {title, todos} = JSON.parse(jsonStr) as {title: string; todos: Todos}
    return {
      protected: true,
      type: 'todo',
      ...rest,
      title,
      todos,
    }
  }
  throw new Error('Invalid note')
}

export function decryptNotes(
  cryptoKey: CryptoKey,
  note: ProtectedNote[]
): Promise<DecryptedProtectedNote[]>
export function decryptNotes(
  cryptoKey: CryptoKey,
  notes: Note[]
): Promise<(PlainNote | DecryptedProtectedNote)[]>
export function decryptNotes(
  cryptoKey: CryptoKey,
  notes: Note[]
): Promise<(PlainNote | DecryptedProtectedNote)[]> {
  return Promise.all(
    notes.map(async (note) =>
      note.type === 'note_protected' || note.type === 'todo_protected'
        ? decryptProtectedNote(cryptoKey, note)
        : note
    )
  )
}

export const encryptNotes = async (
  cryptoKey: CryptoKey,
  notes: DecryptedProtectedNote[]
): Promise<ProtectedNote[]> =>
  Promise.all(notes.map((note) => encryptProtectedNote(cryptoKey, note)))
