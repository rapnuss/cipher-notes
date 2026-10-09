import {db} from '../db'
import {notesTbl, sessionsTbl} from '../db/schema'
import {and, isNotNull, lt} from 'drizzle-orm'
import {env} from '../env'

export const cleanupDb = async () => {
  const cutoffSessions = Date.now() - 1000 * 60 * Number(env.SESSION_TTL_MIN)
  await db.delete(sessionsTbl).where(lt(sessionsTbl.created_at, cutoffSessions))

  const THREE_MONTHS = 1000 * 60 * 60 * 24 * 30 * 3

  const cutoffDeletedNotes = Date.now() - THREE_MONTHS
  await db
    .delete(notesTbl)
    .where(
      and(
        isNotNull(notesTbl.clientside_deleted_at),
        lt(notesTbl.serverside_updated_at, cutoffDeletedNotes),
      ),
    )

  console.info('Cleaned up DB')
}
