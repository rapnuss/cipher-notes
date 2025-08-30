import {z} from 'zod'
import {authEndpointsFactory} from '../endpointsFactory'
import {db} from '../db'
import {usersTbl} from '../db/schema'
import {eq} from 'drizzle-orm'
import createHttpError from 'http-errors'
import {hashPassword, verifyPassword} from '../util/password.js'
import {env} from '../env'

const assertAdmin = async (user_id: number) => {
  const [user] = await db.select().from(usersTbl).where(eq(usersTbl.id, user_id))
  if (!user || user.is_admin !== 1) {
    throw createHttpError(403, 'Forbidden')
  }
}

export const adminCreateUserEndpoint = authEndpointsFactory.build({
  method: 'post',
  input: z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  }),
  output: z.object({}),
  handler: async ({input, options: {user_id}}) => {
    if (env.HOSTING_MODE !== 'self') throw createHttpError(400, 'Only in self-hosted')
    await assertAdmin(user_id)
    const [existing] = await db
      .select()
      .from(usersTbl)
      .where(eq(usersTbl.email, input.username))
      .limit(1)
    if (existing) throw createHttpError(400, 'User exists')
    const password_hash = await hashPassword(input.password)
    await db.insert(usersTbl).values({
      email: input.username,
      password_hash,
      is_admin: 0,
      login_tries_left: 3,
    })
    return {}
  },
})

export const adminSetPasswordEndpoint = authEndpointsFactory.build({
  method: 'post',
  input: z.object({
    target_identifier: z.string().min(1),
    new_password: z.string().min(1),
    admin_password: z.string().min(1),
  }),
  output: z.object({}),
  handler: async ({input, options: {user_id}}) => {
    if (env.HOSTING_MODE !== 'self') throw createHttpError(400, 'Only in self-hosted')
    const [admin] = await db.select().from(usersTbl).where(eq(usersTbl.id, user_id)).limit(1)
    if (!admin || admin.is_admin !== 1 || !admin.password_hash)
      throw createHttpError(403, 'Forbidden')
    const ok = await verifyPassword(input.admin_password, admin.password_hash)
    if (!ok) throw createHttpError(401, 'Invalid admin password')
    const [target] = await db
      .select()
      .from(usersTbl)
      .where(eq(usersTbl.email, input.target_identifier))
      .limit(1)
    if (!target) throw createHttpError(400, 'User not found')
    const password_hash = await hashPassword(input.new_password)
    await db
      .update(usersTbl)
      .set({password_hash, login_tries_left: 3})
      .where(eq(usersTbl.id, target.id))
    return {}
  },
})
