import createHttpError from 'http-errors'
import {eq} from 'drizzle-orm'
import {db} from '../db'
import {usersTbl} from '../db/schema'

type DbOrTx = typeof db

export type UserConfirmFields = {
  id: number
  confirm_code: string | null
  confirm_code_tries_left: number
  confirm_code_created_at: number | null
}

export const verifyConfirmCodeOrThrow = async (
  dbOrTx: DbOrTx,
  user: UserConfirmFields,
  providedCode: string | undefined
) => {
  if (!providedCode) {
    throw createHttpError(400, 'Confirm code required')
  }
  if (!user.confirm_code) {
    throw createHttpError(400, 'Confirm code not set')
  }
  if (user.confirm_code_tries_left <= 0) {
    throw createHttpError(400, 'Confirm code tries left exceeded')
  }
  const createdAt = user.confirm_code_created_at
  if (!createdAt || createdAt + 10 * 60 * 1000 < Date.now()) {
    throw createHttpError(400, 'Confirm code expired')
  }
  if (providedCode !== user.confirm_code) {
    await dbOrTx
      .update(usersTbl)
      .set({confirm_code_tries_left: user.confirm_code_tries_left - 1})
      .where(eq(usersTbl.id, user.id))
    throw createHttpError(400, 'Confirm code does not match')
  }
}
