import {db} from '.'
import {FnProps} from '../util/type'
import {notesTbl} from './schema'
import {and, eq, isNull, sql} from 'drizzle-orm'

type Tx = FnProps<FnProps<typeof db.transaction>>
type Db = typeof db

export const bulkUpdateCommittedSize = async (
  tx: Tx | Db,
  values: {id: string; size: number}[]
) => {
  if (values.length === 0) return
  const vals = sql.join(
    values.map((u) => sql`(${u.id}, ${u.size}::integer)`),
    sql`, `
  )
  await tx.execute(sql`
    UPDATE ${notesTbl}
    SET committed_size = v.size
    FROM (
      VALUES ${vals}
    ) AS v(id, size)
    WHERE ${notesTbl.clientside_id} = v.id;
  `)
}

export const getCipherTextLength = async (tx: Tx | Db, user_id: number): Promise<number> => {
  const [{sum: cipherTextLength = 0} = {}] = await tx
    .select({sum: sql<string>`sum(length(${notesTbl.cipher_text}))`})
    .from(notesTbl)
    .where(eq(notesTbl.user_id, user_id))
  return Number(cipherTextLength)
}

export const getFileStorageUsage = async (tx: Tx | Db, user_id: number): Promise<number> => {
  const [{sum: committedSize = 0} = {}] = await tx
    .select({sum: sql<string>`sum(${notesTbl.committed_size})`})
    .from(notesTbl)
    .where(and(eq(notesTbl.user_id, user_id), isNull(notesTbl.clientside_deleted_at)))
  return Number(committedSize)
}
