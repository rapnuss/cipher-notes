import {z} from 'zod'
import {authEndpointsFactory} from '../endpointsFactory'
import {db} from '../db'
import {notesTbl, sessionsTbl, usersTbl} from '../db/schema'
import createHttpError from 'http-errors'
import {eq} from 'drizzle-orm'
import {s3DeletePrefix} from '../services/s3'
import {hostingMode} from '../env'
import {verifyPasswordWithRateLimitOrThrow} from '../business/password'
import {verifyConfirmCodeOrThrow} from '../business/confirm'

export const deleteNotesEndpoint = authEndpointsFactory.build({
  method: 'post',
  input: z.object({
    confirm: z.string().length(6).optional(),
    password: z.string().min(1).optional(),
  }),
  output: z.object({}),
  handler: async ({ctx: {user_id}, input}) => {
    const [user] = await db.select().from(usersTbl).where(eq(usersTbl.id, user_id))
    if (!user) {
      throw createHttpError(500, 'User not found')
    }
    if (hostingMode === 'self') {
      await verifyPasswordWithRateLimitOrThrow(db, user, input.password)
    } else {
      const {confirm} = input
      await verifyConfirmCodeOrThrow(db, user, confirm)
      await db
        .update(usersTbl)
        .set({
          confirm_code: null,
          confirm_code_tries_left: 0,
          confirm_code_created_at: null,
          new_email: null,
          login_code: null,
          login_tries_left: 0,
          login_code_created_at: null,
        })
        .where(eq(usersTbl.id, user.id))
    }

    await db.transaction(async (tx) => {
      await tx.delete(notesTbl).where(eq(notesTbl.user_id, user.id))
      await tx.update(usersTbl).set({sync_token: null}).where(eq(usersTbl.id, user.id))

      const {errorKeys} = await s3DeletePrefix(`${user.id}/`)
      if (errorKeys.length > 0) {
        throw createHttpError(500, 'Failed to delete some files')
      }
    })
    return {}
  },
})

export const deleteAccountEndpoint = authEndpointsFactory.build({
  method: 'post',
  input: z.object({
    confirm: z.string().length(6).optional(),
    password: z.string().min(1).optional(),
  }),
  output: z.object({}),
  handler: async ({ctx: {user_id}, input}) => {
    const [user] = await db.select().from(usersTbl).where(eq(usersTbl.id, user_id))
    if (!user) {
      throw createHttpError(500, 'User not found')
    }
    if (hostingMode === 'self') {
      await verifyPasswordWithRateLimitOrThrow(db, user, input.password)
    } else {
      const {confirm} = input
      await verifyConfirmCodeOrThrow(db, user, confirm)
    }
    await db.transaction(async (tx) => {
      await tx.delete(notesTbl).where(eq(notesTbl.user_id, user.id))
      await tx.delete(sessionsTbl).where(eq(sessionsTbl.user_id, user.id))
      await tx.delete(usersTbl).where(eq(usersTbl.id, user.id))

      const {errorKeys} = await s3DeletePrefix(`${user.id}/`)
      if (errorKeys.length > 0) {
        throw createHttpError(500, 'Failed to delete some files')
      }
    })
    return {}
  },
})
