import {base64ToBin, binToBase64} from './encryption'

const PBKDF2_ITERATIONS = 100000
const SALT_LENGTH = 16

export const generateMasterSalt = (): string => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  return binToBase64(salt)
}

export const deriveKey = async (password: string, masterSalt: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)
  const salt = base64ToBin(masterSalt)

  const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, [
    'deriveBits',
    'deriveKey',
  ])

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt).buffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {name: 'AES-GCM', length: 256},
    true,
    ['encrypt', 'decrypt']
  )

  return derivedKey
}

const VERIFIER_PLAINTEXT = 'cipher-notes-password-verifier'

export const createVerifier = async (
  key: CryptoKey
): Promise<{verifier: string; verifier_iv: string}> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(VERIFIER_PLAINTEXT)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const cipherText = await crypto.subtle.encrypt({name: 'AES-GCM', iv, tagLength: 128}, key, data)

  return {
    verifier: binToBase64(new Uint8Array(cipherText)),
    verifier_iv: binToBase64(iv),
  }
}

export const verifyPassword = async (
  key: CryptoKey,
  verifier: string,
  verifier_iv: string
): Promise<boolean> => {
  try {
    const iv = base64ToBin(verifier_iv)
    const cipherText = base64ToBin(verifier)

    const decrypted = await crypto.subtle.decrypt(
      {name: 'AES-GCM', iv: new Uint8Array(iv).buffer, tagLength: 128},
      key,
      new Uint8Array(cipherText).buffer
    )

    const decoder = new TextDecoder()
    const plaintext = decoder.decode(decrypted)

    return plaintext === VERIFIER_PLAINTEXT
  } catch {
    return false
  }
}
