import {z} from 'zod'
import {safeJsonParse} from './misc'

export const zodParseString = <Schema extends z.ZodTypeAny>(
  schema: Schema,
  str: unknown
): z.infer<Schema> | undefined => {
  if (typeof str !== 'string') {
    return undefined
  }
  const res = schema.safeParse(safeJsonParse(str))
  return res.success ? res.data : undefined
}
