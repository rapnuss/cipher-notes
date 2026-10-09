import {z} from 'zod'

export const sessionSchema = z.object({access_token: z.string(), session_id: z.number()})
