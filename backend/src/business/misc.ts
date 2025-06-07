import {SubscriptionType} from '../db/schema'
import {signJwt} from '../services/jwt'
import {generateSalt, hashToken} from '../util/hash'

export const generateLoginCode = () => {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')
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
