import {z} from 'zod'
import {
  base64ToBin,
  calculateChecksum,
  decryptString,
  encryptString,
  importKey,
} from '../util/encryption'
import {EncPut} from '../services/backend'
import {Overwrite} from '../util/type'

type UpsertPut = {
  id: string
  type: 'note' | 'todo' | 'label'
  created_at: number
  updated_at: number
  txt: string
  version: number
  deleted_at: null
}
export type Put =
  | UpsertPut
  | Overwrite<UpsertPut, {type: 'file'; size: number}>
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
