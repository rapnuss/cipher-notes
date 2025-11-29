import {db} from '../db'
import z from 'zod'
import {authEndpointsFactory} from '../endpointsFactory'
import {protectedNotesConfigTbl} from '../db/schema'
import {eq} from 'drizzle-orm'

const protectedNotesConfigSchema = z.object({
  master_salt: z.string(),
  verifier: z.string(),
  verifier_iv: z.string(),
  updated_at: z.number(),
})

export const getProtectedNotesConfigEndpoint = authEndpointsFactory.build({
  method: 'get',
  output: z.object({
    config: protectedNotesConfigSchema.nullable(),
  }),
  handler: async ({options: {user_id}}) => {
    const configs = await db
      .select()
      .from(protectedNotesConfigTbl)
      .where(eq(protectedNotesConfigTbl.user_id, user_id))
      .limit(1)

    const config = configs[0]
    if (!config) {
      return {config: null}
    }

    return {
      config: {
        master_salt: config.master_salt,
        verifier: config.verifier,
        verifier_iv: config.verifier_iv,
        updated_at: config.updated_at,
      },
    }
  },
})

export const putProtectedNotesConfigEndpoint = authEndpointsFactory.build({
  method: 'post',
  input: z.object({
    master_salt: z.string(),
    verifier: z.string(),
    verifier_iv: z.string(),
    updated_at: z.number(),
  }),
  output: z.object({
    success: z.boolean(),
  }),
  handler: async ({input, options: {user_id}}) => {
    await db
      .insert(protectedNotesConfigTbl)
      .values({
        user_id,
        master_salt: input.master_salt,
        verifier: input.verifier,
        verifier_iv: input.verifier_iv,
        updated_at: input.updated_at,
      })
      .onConflictDoUpdate({
        target: protectedNotesConfigTbl.user_id,
        set: {
          master_salt: input.master_salt,
          verifier: input.verifier,
          verifier_iv: input.verifier_iv,
          updated_at: input.updated_at,
        },
      })

    return {success: true}
  },
})
