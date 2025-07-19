import {db} from '.'
import {FnProps} from '../util/type'
import {notesTbl} from './schema'
import {sql} from 'drizzle-orm'

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
