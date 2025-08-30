import {scrypt as _scrypt, randomBytes} from 'crypto'

const scrypt = (password: string, salt: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    _scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })

export const hashPassword = async (password: string): Promise<string> => {
  const saltHex = randomBytes(16).toString('hex')
  const key = await scrypt(password, saltHex)
  return `${saltHex}:${key.toString('hex')}`
}

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const [saltHex, keyHex] = stored.split(':')
  if (!saltHex || !keyHex) return false
  const key = Buffer.from(keyHex, 'hex')
  const derived = await scrypt(password, saltHex)
  return constantTimeEquals(new Uint8Array(derived), new Uint8Array(key))
}

const constantTimeEquals = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!
  }
  return result === 0
}
