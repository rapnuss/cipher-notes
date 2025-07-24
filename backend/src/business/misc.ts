import {SubscriptionType} from '../db/schema'
import {signJwt} from '../services/jwt'
import {generateSalt, hashToken} from '../util/hash'

// on big O, no 0, no big I, no small l
const CODE_CHARS = '123456789abcdefghijkmnopqrstuvwxyz'

export const generateLoginCode = () => {
  return Array.from(
    {length: 6},
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('')
}

export const generateSession = () => {
  const accessToken = crypto.randomUUID()
  const salt = generateSalt()
  const hash = hashToken(accessToken, salt)
  return {accessToken, salt, hash}
}

export type Features = 'password_protected_notes' | 'reminders'

export const getFeaturesRec = (subscription: SubscriptionType): Record<Features, boolean> => ({
  password_protected_notes: subscription !== 'free',
  reminders: subscription !== 'free',
})

export const getFeaturesArr = (subscription: SubscriptionType): Features[] => {
  const rec = getFeaturesRec(subscription)
  const features: Features[] = []
  for (const key in rec) {
    if (rec[key as Features]) {
      features.push(key as Features)
    }
  }
  return features
}

export const signSubscriptionToken = (
  userId: number,
  subscription: SubscriptionType,
  expiry: number
) => signJwt({sub: userId.toString(), features: getFeaturesArr(subscription)}, expiry)
