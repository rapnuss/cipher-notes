import {db} from '../db'
import z from 'zod'
import {authEndpointsFactory} from '../endpointsFactory'
import {getCipherTextLength, getFileStorageUsage} from '../db/helpers'
import {env} from '../env'

export const storageUsageEndpoint = authEndpointsFactory.build({
  method: 'get',
  output: z.object({
    files: z.object({
      used: z.number(),
      limit: z.number(),
    }),
    notes: z.object({
      used: z.number(),
      limit: z.number(),
    }),
  }),
  handler: async ({ctx: {user_id}}) => {
    const cipherTextLength = await getCipherTextLength(db, user_id)
    const committedSize = await getFileStorageUsage(db, user_id)
    const notes = {
      used: cipherTextLength,
      limit: Number(env.NOTES_STORAGE_LIMIT),
    }
    const files = {
      used: committedSize,
      limit: Number(env.FILES_STORAGE_LIMIT),
    }
    return {files, notes}
  },
})
