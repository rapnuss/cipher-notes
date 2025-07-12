import {z} from 'zod'
import {authEndpointsFactory} from '../endpointsFactory'
import {db} from '../db'
import {notesTbl} from '../db/schema'
import {and, eq, inArray, isNull} from 'drizzle-orm'
import {s3} from '../services/s3'

export const getUploadUrlsEndpoint = authEndpointsFactory.build({
  method: 'post',
  input: z.object({
    note_ids: z.array(z.string().uuid()),
  }),
  output: z.object({
    urls: z.array(z.object({note_id: z.string().uuid(), url: z.string().url()})),
  }),
  handler: async ({input: {note_ids}, options: {user_id}}) => {
    const notes = await db
      .select()
      .from(notesTbl)
      .where(
        and(
          eq(notesTbl.user_id, user_id),
          inArray(notesTbl.clientside_id, note_ids),
          eq(notesTbl.type, 'file'),
          isNull(notesTbl.clientside_deleted_at)
        )
      )
    const urls = notes.map((note) => ({
      note_id: note.clientside_id,
      url: s3.presign(`${user_id}/${note.clientside_id}`, {
        method: 'PUT',
        type: 'application/octet-stream',
        expiresIn: 60 * 60,
      }),
    }))
    return {urls}
  },
})

export const getDownloadUrlsEndpoint = authEndpointsFactory.build({
  method: 'get',
  input: z.object({
    note_ids: z.array(z.string().uuid()),
  }),
  output: z.object({
    urls: z.array(z.object({note_id: z.string().uuid(), url: z.string().url()})),
  }),
  handler: async ({input: {note_ids}, options: {user_id}}) => {
    const notes = await db
      .select()
      .from(notesTbl)
      .where(
        and(
          eq(notesTbl.user_id, user_id),
          inArray(notesTbl.clientside_id, note_ids),
          eq(notesTbl.type, 'file'),
          isNull(notesTbl.clientside_deleted_at)
        )
      )
    const urls = notes.map((note) => ({
      note_id: note.clientside_id,
      url: s3.presign(`${user_id}/${note.clientside_id}`, {
        method: 'GET',
        expiresIn: 60 * 60,
      }),
    }))
    return {urls}
  },
})
