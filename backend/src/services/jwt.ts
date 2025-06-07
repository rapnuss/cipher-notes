import {JWTPayload, SignJWT, importPKCS8} from 'jose'
import {readFileSync} from 'fs'

const pem = readFileSync('jwt-private.pem', 'utf-8')
const privateKey = await importPKCS8(pem, 'RS256')

export const signJwt = (payload: JWTPayload, expiry: number) =>
  new SignJWT(payload)
    .setProtectedHeader({alg: 'RS256'})
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(privateKey)
