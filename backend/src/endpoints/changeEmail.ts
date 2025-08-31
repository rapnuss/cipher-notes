import {z} from 'zod'
import {endpointsFactory} from '../endpointsFactory'
import {usersTbl} from '../db/schema'
import {db} from '../db'
import createHttpError from 'http-errors'
import {eq} from 'drizzle-orm'
import {generateLoginCode} from '../business/misc'
import {sendConfirmCode} from '../services/mail'
import {hostingMode} from '../env'
import {verifyConfirmCodeOrThrow} from '../business/confirm'

export const sendChangeEmailCodesEndpoint = endpointsFactory.build({
  method: 'post',
  input: z.object({
    new_email: z.string().email(),
    old_email: z.string().email(),
  }),
  output: z.object({}),
  handler: async ({input: {new_email, old_email}}) => {
    if (hostingMode === 'self') {
      throw createHttpError(400, 'Change email disabled')
    }
    const [user] = await db.select().from(usersTbl).where(eq(usersTbl.email, old_email))
    if (!user) {
      throw createHttpError(400, 'User not found')
    }

    if (
      user.new_email &&
      user.confirm_code_created_at &&
      user.confirm_code_created_at + 10 * 60 * 1000 > Date.now()
    ) {
      throw createHttpError(400, 'Codes already requested recently!')
    }

    await db.transaction(async (tx) => {
      const oldEmailCode = generateLoginCode()
      const newEmailCode = generateLoginCode()

      await tx
        .update(usersTbl)
        .set({
          login_code: newEmailCode,
          new_email: new_email,
          confirm_code: oldEmailCode,
          confirm_code_created_at: Date.now(),
          confirm_code_tries_left: 3,
        })
        .where(eq(usersTbl.id, user.id))

      await sendConfirmCode(old_email, oldEmailCode)
      await sendConfirmCode(new_email, newEmailCode)
    })

    return {}
  },
})

export const changeEmailEndpoint = endpointsFactory.build({
  method: 'post',
  input: z.object({
    old_email: z.string().email(),
    old_email_code: z.string().length(6),
    new_email_code: z.string().length(6),
  }),
  output: z.object({}),
  handler: async ({input: {old_email, old_email_code, new_email_code}}) => {
    const [user] = await db.select().from(usersTbl).where(eq(usersTbl.email, old_email))
    if (!user) {
      throw createHttpError(400, 'User not found')
    }
    if (!user.confirm_code || !user.new_email || !user.login_code) {
      throw createHttpError(400, 'No change email codes sent.')
    }
    await verifyConfirmCodeOrThrow(db, user, old_email_code)
    if (new_email_code !== user.login_code) {
      await db
        .update(usersTbl)
        .set({confirm_code_tries_left: user.confirm_code_tries_left - 1})
        .where(eq(usersTbl.id, user.id))
      throw createHttpError(400, 'Confirm code does not match')
    }
    await db
      .update(usersTbl)
      .set({
        email: user.new_email,
        new_email: null,
        login_code: null,
        login_code_created_at: null,
        login_tries_left: 0,
        confirm_code: null,
        confirm_code_tries_left: 0,
        confirm_code_created_at: null,
      })
      .where(eq(usersTbl.id, user.id))
    return {}
  },
})
