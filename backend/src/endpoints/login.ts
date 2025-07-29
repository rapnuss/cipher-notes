import {endpointsFactory} from '../endpointsFactory'
import {z} from 'zod'
import {db} from '../db/index'
import {sessionsTbl, usersTbl} from '../db/schema'
import {eq} from 'drizzle-orm'
import {generateLoginCode, generateSession, signSubscriptionToken} from '../business/misc'
import {sendLoginCode} from '../services/mail'
import createHttpError from 'http-errors'
import {verify} from 'hcaptcha'
import {env} from '../env'

export const registerEmailEndpoint = endpointsFactory.build({
  method: 'post',
  input: z.object({
    email: z.string().email(),
    captcha_token: z.string(),
  }),
  output: z.object({}),
  handler: async ({input: {email, captcha_token}}) => {
    const res = await verify(env.HCAPTCHA_SECRET, captcha_token, undefined, env.HCAPTCHA_SITE_KEY)
    if (!res.success) {
      throw createHttpError(400, 'Invalid captcha')
    }
    const users = await db.select().from(usersTbl).where(eq(usersTbl.email, email))
    if (users.length === 1) {
      throw createHttpError(400, 'User already exists')
    }
    await db.insert(usersTbl).values({email})
    return {}
  },
})

export const sendLoginCodeEndpoint = endpointsFactory.build({
  method: 'post',
  input: z.object({
    email: z.string().email(),
  }),
  output: z.object({}),
  handler: async ({input: {email}}) => {
    const [user] = await db.select().from(usersTbl).where(eq(usersTbl.email, email))
    if (!user) {
      throw createHttpError(400, 'User not found')
    }

    const lastCodeSent = user.login_code_created_at
    if (lastCodeSent && Date.now() - lastCodeSent < 10_000) {
      throw createHttpError(400, 'Code already sent recently')
    }

    const login_code = generateLoginCode()
    await sendLoginCode(email, login_code)

    await db
      .update(usersTbl)
      .set({
        login_code,
        login_code_created_at: Date.now(),
        login_tries_left: 3,
        confirm_code: null,
        confirm_code_tries_left: 0,
        confirm_code_created_at: null,
        new_email: null,
      })
      .where(eq(usersTbl.id, user.id))

    return {}
  },
})

export const loginWithCodeEndpoint = endpointsFactory.build({
  method: 'post',
  input: z.object({
    email: z.string().email(),
    login_code: z.string().length(6),
  }),
  output: z.object({access_token: z.string(), session_id: z.number(), jwt: z.string()}),
  handler: async ({input}) => {
    const [user] = await db.select().from(usersTbl).where(eq(usersTbl.email, input.email))
    if (!user) {
      throw createHttpError(400, 'User not found')
    }

    if (!user.login_code || !user.login_code_created_at) {
      throw createHttpError(400, 'No login code set')
    }

    if (Date.now() - user.login_code_created_at > 10 * 60 * 1000) {
      throw createHttpError(400, 'Login code expired')
    }

    if (user.login_tries_left === 0) {
      throw createHttpError(400, 'No tries left')
    }

    if (user.login_code !== input.login_code) {
      await db
        .update(usersTbl)
        .set({login_tries_left: user.login_tries_left - 1})
        .where(eq(usersTbl.id, user.id))
      throw createHttpError(400, 'Invalid login code')
    }

    await db
      .update(usersTbl)
      .set({
        login_code: null,
        login_code_created_at: null,
        login_tries_left: 0,
        confirm_code: null,
        confirm_code_tries_left: 0,
        confirm_code_created_at: null,
        new_email: null,
        successful_login_at: Date.now(),
      })
      .where(eq(usersTbl.id, user.id))

    const jwtPromise = signSubscriptionToken(
      user.id,
      user.subscription,
      Date.now() + 1000 * 60 * 60 * 24 * 31
    )

    return await db.transaction(async (tx) => {
      const {accessToken, salt, hash} = generateSession()
      const [{session_id} = {}] = await tx
        .insert(sessionsTbl)
        .values({
          user_id: user.id,
          access_token_hash: hash,
          access_token_salt: salt,
        })
        .returning({session_id: sessionsTbl.id})
      return {access_token: accessToken, session_id: session_id!, jwt: await jwtPromise}
    })
  },
})
