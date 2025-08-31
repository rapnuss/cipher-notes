import createHttpError from 'http-errors'
import {eq} from 'drizzle-orm'
import {db} from '../db'
import {usersTbl} from '../db/schema'
import {verifyPassword} from '../util/password.js'

type DbOrTx = typeof db

export type UserPasswordRateLimitFields = {
  id: number
  password_hash: string | null
  confirm_code_tries_left: number
  confirm_code_created_at: number | null
}

export const verifyPasswordWithRateLimitOrThrow = async (
  dbOrTx: DbOrTx,
  user: UserPasswordRateLimitFields,
  providedPassword: string | undefined
) => {
  if (!user.password_hash) throw createHttpError(400, 'No password set')
  if (!providedPassword) throw createHttpError(400, 'Password required')
  if (
    user.confirm_code_tries_left === 0 &&
    user.confirm_code_created_at &&
    Date.now() - user.confirm_code_created_at < 5 * 60_000
  ) {
    throw createHttpError(400, 'Too many login attempts, wait 5 minutes!')
  }
  const ok = await verifyPassword(providedPassword, user.password_hash)
  if (!ok) {
    await dbOrTx
      .update(usersTbl)
      .set({
        confirm_code_tries_left:
          user.confirm_code_tries_left === 0 ? 2 : Math.max(0, user.confirm_code_tries_left - 1),
        confirm_code_created_at:
          user.confirm_code_tries_left === 3 || user.confirm_code_tries_left === 0
            ? Date.now()
            : undefined,
      })
      .where(eq(usersTbl.id, user.id))
    throw createHttpError(400, 'Invalid password')
  }
  await dbOrTx
    .update(usersTbl)
    .set({confirm_code_tries_left: 3, confirm_code_created_at: null})
    .where(eq(usersTbl.id, user.id))
}
