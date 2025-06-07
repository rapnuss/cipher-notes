import {importSPKI, JWTPayload, jwtVerify} from 'jose'
import PUBLIC_KEY from '../../jwt-public.pub?raw'

let cachedKey: CryptoKey | null = null

export async function getPublicKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    cachedKey = await importSPKI(PUBLIC_KEY, 'RS256')
  }
  return cachedKey
}

export async function verifyJwt(token: string): Promise<JWTPayload> {
  const key = await getPublicKey()
  const {payload} = await jwtVerify(token, key, {clockTolerance: '30s'})
  return payload
}
