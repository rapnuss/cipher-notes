import {Note, Todos} from './models'
import {binToBase64, base64ToBin} from '../util/encryption'
import {getProtectedNotesKey} from '../state/protectedNotes'

export type EncryptedNoteContent = {
  cipher_text: string
  iv: string
}

export const generateIv = (): string => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  return binToBase64(iv)
}

export const encryptNoteContent = async (
  key: CryptoKey,
  content: string
): Promise<EncryptedNoteContent> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const cipherText = await crypto.subtle.encrypt({name: 'AES-GCM', iv, tagLength: 128}, key, data)

  return {
    cipher_text: binToBase64(new Uint8Array(cipherText)),
    iv: binToBase64(iv),
  }
}

export const decryptNoteContent = async (
  key: CryptoKey,
  cipherText: string,
  iv: string
): Promise<string> => {
  const ivBytes = base64ToBin(iv)
  const cipherBytes = base64ToBin(cipherText)

  const ivBuffer = new Uint8Array(ivBytes).buffer
  const cipherBuffer = new Uint8Array(cipherBytes).buffer

  const decrypted = await crypto.subtle.decrypt(
    {name: 'AES-GCM', iv: ivBuffer, tagLength: 128},
    key,
    cipherBuffer
  )

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

export type PlainNoteData = {
  title: string
  txt?: string
  todos?: Todos
}

export const encryptNotePlainData = async (
  key: CryptoKey,
  data: PlainNoteData
): Promise<{encrypted: string; iv: string}> => {
  const json = JSON.stringify(data)
  const {cipher_text, iv} = await encryptNoteContent(key, json)
  return {encrypted: cipher_text, iv}
}

export const decryptNotePlainData = async (
  key: CryptoKey,
  encrypted: string,
  iv: string
): Promise<PlainNoteData> => {
  const json = await decryptNoteContent(key, encrypted, iv)
  return JSON.parse(json)
}

export const encryptNoteForStorage = async (note: Note, key: CryptoKey): Promise<Note> => {
  const plainData: PlainNoteData = {
    title: note.title,
    ...(note.type === 'note' ? {txt: note.txt} : {todos: note.todos}),
  }
  const {encrypted, iv} = await encryptNotePlainData(key, plainData)

  if (note.type === 'note') {
    return {
      ...note,
      title: '',
      txt: encrypted,
      protected: 1,
      protected_iv: iv,
    }
  } else {
    return {
      ...note,
      title: '',
      todos: [{id: encrypted, done: false, txt: ''}],
      protected: 1,
      protected_iv: iv,
    }
  }
}

export const decryptNoteFromStorage = async (note: Note, key: CryptoKey): Promise<Note> => {
  if (note.protected !== 1 || !note.protected_iv) {
    return note
  }

  const encrypted = note.type === 'note' ? note.txt : note.todos[0]?.id ?? ''
  const plainData = await decryptNotePlainData(key, encrypted, note.protected_iv)

  if (note.type === 'note') {
    return {
      ...note,
      title: plainData.title,
      txt: plainData.txt ?? '',
    }
  } else {
    return {
      ...note,
      title: plainData.title,
      todos: plainData.todos ?? [],
    }
  }
}

export const canDecryptNote = (note: Note): boolean => {
  if (note.protected !== 1) return true
  return getProtectedNotesKey() !== null
}

export const tryDecryptNote = async (note: Note): Promise<Note | null> => {
  if (note.protected !== 1) return note

  const key = getProtectedNotesKey()
  if (!key) return null

  try {
    return await decryptNoteFromStorage(note, key)
  } catch (e) {
    console.error('Failed to decrypt note:', e)
    return null
  }
}

export const encryptFileTitle = async (
  key: CryptoKey,
  title: string
): Promise<{encrypted: string; iv: string}> => {
  const {cipher_text, iv} = await encryptNoteContent(key, title)
  return {encrypted: cipher_text, iv}
}

export const decryptFileTitle = async (
  key: CryptoKey,
  encrypted: string,
  iv: string
): Promise<string> => {
  return await decryptNoteContent(key, encrypted, iv)
}
