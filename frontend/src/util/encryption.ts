export function calculateChecksum(data: Uint8Array): number {
  return data.reduce((checksum, byte) => (checksum + byte) % 256, 0)
}

export function generateSalt(length = 16): string {
  return binToBase64(crypto.getRandomValues(new Uint8Array(length)))
}

export function binToBase64(iv: Uint8Array): string {
  return btoa(String.fromCharCode(...iv))
}
export function base64ToBin(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return binToBase64(new Uint8Array(buffer))
}
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  return base64ToBin(base64).buffer
}

export async function generateKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    {name: 'AES-GCM', length: 256}, // Algorithm and key size
    true, // The key can be exported
    ['encrypt', 'decrypt'] // Usages
  )
  return await exportKey(key)
}

async function exportKey(key: CryptoKey): Promise<string> {
  const exportedKey = await crypto.subtle.exportKey('raw', key)
  return arrayBufferToBase64(exportedKey)
}

export async function importKey(base64Key: string): Promise<CryptoKey> {
  const binaryKey = base64ToBin(base64Key)
  const key = await crypto.subtle.importKey(
    'raw',
    binaryKey,
    {name: 'AES-GCM'}, // Algorithm
    true, // Whether the key can be exported again
    ['encrypt', 'decrypt'] // Usages
  )
  return key
}

export async function encryptString(
  key: CryptoKey,
  data: string
): Promise<{cipher_text: string; iv: string}> {
  const encoder = new TextEncoder()
  const encodedData = encoder.encode(data)

  const iv = crypto.getRandomValues(new Uint8Array(12)) // 12 bytes for AES-GCM
  const cipher_text = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, encodedData)
  return {cipher_text: arrayBufferToBase64(cipher_text), iv: binToBase64(iv)}
}

export async function decryptString(
  key: CryptoKey,
  cipher_text: string,
  ivBase64: string
): Promise<string> {
  const decryptedData = await crypto.subtle.decrypt(
    {name: 'AES-GCM', iv: base64ToBin(ivBase64)},
    key,
    base64ToArrayBuffer(cipher_text)
  )
  const decoder = new TextDecoder()
  return decoder.decode(decryptedData)
}

export async function encryptBlob(key: CryptoKey, blob: Blob): Promise<Blob> {
  const data = await blob.arrayBuffer()
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 12 bytes for AES-GCM
  const cipherText = await crypto.subtle.encrypt({name: 'AES-GCM', iv, tagLength: 128}, key, data)
  return new Blob([iv, new Uint8Array(cipherText)], {
    type: 'application/octet-stream',
  })
}

export async function decryptBlob(
  encryptedBlob: Blob,
  key: CryptoKey,
  mime: string
): Promise<Blob> {
  const encryptedArrayBuffer = await encryptedBlob.arrayBuffer()
  const iv = new Uint8Array(encryptedArrayBuffer.slice(0, 12))
  const cipherText = encryptedArrayBuffer.slice(12)
  const plaintextArrayBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    key,
    cipherText
  )
  return new Blob([plaintextArrayBuffer], {type: mime})
}
