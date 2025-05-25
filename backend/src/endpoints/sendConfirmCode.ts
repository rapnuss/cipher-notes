import {z} from 'zod'
import {authEndpointsFactory} from '../endpointsFactory'
import createHttpError from 'http-errors'
import {generateLoginCode} from '../business/misc'
import {db} from '../db'
import {usersTbl} from '../db/schema'
import {sendConfirmCode} from '../services/mail'
import {eq} from 'drizzle-orm'

export const sendConfirmCodeEndpoint = authEndpointsFactory.build({
  method: 'post',
  output: z.object({}),
  handler: async ({options: {user_id}}) => {
    const [user] = await db.select().from(usersTbl).where(eq(usersTbl.id, user_id))
    if (!user) {
      throw createHttpError(500, 'User not found')
    }
    if (
      user.confirm_code_created_at &&
      user.confirm_code_created_at + 10 * 60 * 1000 > Date.now()
    ) {
      throw createHttpError(400, 'Confirm code already sent recently')
    }
    const confirm_code = generateLoginCode()
    await sendConfirmCode(user.email, confirm_code)
    await db
      .update(usersTbl)
      .set({
        confirm_code,
        confirm_code_created_at: Date.now(),
        confirm_code_tries_left: 3,
        new_email: null,
        login_code: null,
        login_code_created_at: null,
        login_tries_left: 0,
      })
      .where(eq(usersTbl.id, user.id))

    return {}
  },
})
